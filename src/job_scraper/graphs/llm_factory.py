"""Centralized LLM configuration — single source of truth.

Every graph imports models from here instead of declaring its own.
Changing a model, API key, or temperature is a one-line change.

Supported models:
  • DeepSeek Chat  — fast + cheap, used for search, extraction, parsing (Fallback: local Ollama)
  • Gemini Flash   — strong reasoning, used for scoring, assessment, gap analysis (Fallback: local Ollama)
"""

import os
from functools import lru_cache

from langchain_openai import ChatOpenAI
from langchain_google_genai import ChatGoogleGenerativeAI


@lru_cache(maxsize=1)
def get_ollama_chat(model_name: str = "glm-5.1:cloud") -> ChatOpenAI:
    """Local Ollama instance via OpenAI-compatible endpoint.

    Allows running locally without API keys.
    """
    base_url = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434/v1")
    return ChatOpenAI(
        model=model_name,
        api_key="ollama",  # API key placeholder required by validator
        base_url=base_url,
        temperature=0,
        max_retries=3,
    )


@lru_cache(maxsize=1)
def get_deepseek_chat() -> ChatOpenAI:
    """DeepSeek Chat — fast, cheap, reliable for structured extraction.

    Falls back to local Ollama if USE_OLLAMA=true.
    """
    use_ollama = os.environ.get("USE_OLLAMA", "").lower() == "true"
    if use_ollama:
        model = os.environ.get("OLLAMA_MODEL", "glm-5.1:cloud")
        return get_ollama_chat(model)

    return ChatOpenAI(
        model="deepseek-chat",
        api_key=os.environ.get("DEEPSEEK_API_KEY", ""),
        base_url="https://api.deepseek.com",
        temperature=0,
        max_retries=3,
    )


@lru_cache(maxsize=1)
def get_gemini_flash() -> ChatGoogleGenerativeAI:
    """Gemini 2.5 Flash — strong reasoning for scoring and assessment.

    Falls back to local Ollama if USE_OLLAMA=true.
    """
    use_ollama = os.environ.get("USE_OLLAMA", "").lower() == "true"
    if use_ollama:
        model = os.environ.get("OLLAMA_MODEL", "glm-5.1:cloud")
        # ChatGoogleGenerativeAI returns a LangChain class, but since we are returning
        # ChatOpenAI (Ollama) here, Python dynamic typing handles it fine in graph nodes.
        return get_ollama_chat(model)  # type: ignore[return-value]

    return ChatGoogleGenerativeAI(
        model="gemini-2.5-flash",
        google_api_key=os.environ.get("GOOGLE_API_KEY", ""),
        temperature=0,
        max_retries=3,
    )

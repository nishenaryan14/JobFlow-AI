"""Centralized LLM configuration — single source of truth.

Every graph imports models from here instead of declaring its own.
Changing a model, API key, or temperature is a one-line change.

Supported models:
  • DeepSeek Chat     — fast + cheap, used for extraction, parsing, search
  • DeepSeek Reasoner — deep CoT reasoning, used for scoring, gap analysis, enhancement
  • Gemini Flash      — strong reasoning, used as fallback for reasoner tasks
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

    Used for: keyword extraction, resume parsing, search queries, quick tasks.
    Falls back to local Ollama if USE_OLLAMA=true.
    """
    cloud_model = ChatOpenAI(
        model="deepseek-chat",
        api_key=os.environ.get("DEEPSEEK_API_KEY", ""),
        base_url="https://api.deepseek.com",
        temperature=0,
        max_retries=3,
    )

    use_ollama = os.environ.get("USE_OLLAMA", "").lower() == "true"
    if use_ollama:
        model = os.environ.get("OLLAMA_MODEL", "glm-5.1:cloud")
        ollama_model = get_ollama_chat(model)
        # Attempt Ollama, fall back to cloud if it fails
        return ollama_model.with_fallbacks([cloud_model]) # type: ignore[return-value]

    return cloud_model


@lru_cache(maxsize=1)
def get_deepseek_reasoner() -> ChatOpenAI:
    """DeepSeek Reasoner (R1) — heavy reasoning with Chain-of-Thought.

    Used for: ATS gap analysis, resume enhancement, scoring, assessment.
    Generates internal CoT before answering → significantly better results
    on complex analytical tasks.

    NOTE: temperature, top_p, penalties are IGNORED by this model.
    Falls back to Gemini Flash → DeepSeek Chat if unavailable.
    """
    reasoner_model = ChatOpenAI(
        model="deepseek-reasoner",
        api_key=os.environ.get("DEEPSEEK_API_KEY", ""),
        base_url="https://api.deepseek.com",
        temperature=0,  # Ignored by API but required by validator
        max_tokens=16384,
        max_retries=2,
    )

    # Fallback chain: Reasoner → Gemini Flash → DeepSeek Chat
    gemini_fallback = get_gemini_flash()
    chat_fallback = ChatOpenAI(
        model="deepseek-chat",
        api_key=os.environ.get("DEEPSEEK_API_KEY", ""),
        base_url="https://api.deepseek.com",
        temperature=0,
        max_retries=3,
    )

    return reasoner_model.with_fallbacks([gemini_fallback, chat_fallback])  # type: ignore[return-value]


@lru_cache(maxsize=1)
def get_gemini_flash() -> ChatGoogleGenerativeAI:
    """Gemini 2.5 Flash — strong reasoning for scoring and assessment.

    Falls back to local Ollama if USE_OLLAMA=true.
    """
    cloud_model = ChatGoogleGenerativeAI(
        model="gemini-2.5-flash",
        google_api_key=os.environ.get("GOOGLE_API_KEY", ""),
        temperature=0,
        max_retries=3,
    )

    use_ollama = os.environ.get("USE_OLLAMA", "").lower() == "true"
    if use_ollama:
        model = os.environ.get("OLLAMA_MODEL", "glm-5.1:cloud")
        ollama_model = get_ollama_chat(model)
        # Attempt Ollama, fall back to cloud if it fails
        return ollama_model.with_fallbacks([cloud_model])  # type: ignore[return-value]

    return cloud_model

"""Centralized LLM configuration — single source of truth.

Every graph imports models from here instead of declaring its own.
Changing a model, API key, or temperature is a one-line change.

Supported models:
  • DeepSeek Chat  — fast + cheap, used for search, extraction, parsing
  • Gemini Flash   — strong reasoning, used for scoring, assessment, gap analysis
"""

import os
from functools import lru_cache

from langchain_openai import ChatOpenAI
from langchain_google_genai import ChatGoogleGenerativeAI


@lru_cache(maxsize=1)
def get_deepseek_chat() -> ChatOpenAI:
    """DeepSeek Chat — fast, cheap, reliable for structured extraction.

    Used by: resume parsing, JD analysis, job search, detail extraction.
    """
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

    Used by: resume assessment, ATS scoring, resume enhancement, job matching.
    """
    return ChatGoogleGenerativeAI(
        model="gemini-2.5-flash",
        google_api_key=os.environ.get("GOOGLE_API_KEY", ""),
        temperature=0,
        max_retries=3,
    )

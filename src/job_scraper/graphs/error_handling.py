"""Centralized error handling and retry logic for graph nodes.

Provides:
  • LLM call retry with exponential backoff
  • Structured output extraction with guaranteed schema compliance
  • Graceful fallback for non-critical nodes
"""

import json
import logging
import asyncio
from typing import Any, Type, TypeVar

from pydantic import BaseModel
from langchain_core.language_models import BaseChatModel
from langchain_core.messages import HumanMessage, SystemMessage

logger = logging.getLogger("jobflow.graphs")

T = TypeVar("T", bound=BaseModel)


async def call_llm_structured(
    llm: BaseChatModel,
    prompt: str,
    output_schema: Type[T],
    system_prompt: str = "You are a helpful AI assistant. Output only valid JSON.",
    max_retries: int = 3,
) -> T:
    """Call an LLM with structured output guarantee and retry logic.

    Uses LangChain's with_structured_output() for schema enforcement.
    Falls back to raw JSON parsing if structured output fails.

    Args:
        llm: The LangChain chat model to use.
        prompt: The user prompt.
        output_schema: Pydantic model class for the expected output.
        system_prompt: System prompt for the LLM.
        max_retries: Number of retry attempts.

    Returns:
        A validated instance of output_schema.

    Raises:
        ValueError: If all retries fail to produce valid structured output.
    """
    last_error = None

    for attempt in range(1, max_retries + 1):
        # Strategy 1: Use with_structured_output (preferred)
        try:
            structured_llm = llm.with_structured_output(output_schema)
            result = await structured_llm.ainvoke([
                SystemMessage(content=system_prompt),
                HumanMessage(content=prompt),
            ])
            if result is not None:
                return result

        except (AttributeError, NotImplementedError):
            # Model doesn't support with_structured_output — fall through to Strategy 2
            pass

        except Exception as exc:
            last_error = exc
            logger.warning(
                f"[call_llm_structured] Strategy 1 attempt {attempt}/{max_retries} "
                f"failed for {output_schema.__name__}: {exc}"
            )
            # FALL THROUGH to Strategy 2 (raw JSON) instead of retrying Strategy 1

        # Strategy 2: Raw completion + JSON parse (always tried if Strategy 1 failed)
        try:
            raw_result = await llm.ainvoke([
                SystemMessage(content=system_prompt + " Output ONLY valid JSON, no markdown."),
                HumanMessage(content=prompt),
            ])
            content = raw_result.content if hasattr(raw_result, "content") else str(raw_result)

            # Strip markdown code fences
            import re
            content = re.sub(r"```(?:json)?\s*", "", content).replace("```", "").strip()

            parsed = json.loads(content)
            return output_schema.model_validate(parsed)

        except Exception as parse_exc:
            last_error = parse_exc
            logger.warning(
                f"[call_llm_structured] Strategy 2 attempt {attempt}/{max_retries} "
                f"failed for {output_schema.__name__}: {parse_exc}"
            )
            if attempt < max_retries:
                await asyncio.sleep(2 ** attempt)

    raise ValueError(
        f"Failed to get structured output for {output_schema.__name__} "
        f"after {max_retries} attempts. Last error: {last_error}"
    )


async def call_llm_text(
    llm: BaseChatModel,
    prompt: str,
    system_prompt: str = "You are a helpful AI assistant.",
    max_retries: int = 3,
) -> str:
    """Call an LLM for free-text output with retry logic.

    Args:
        llm: The LangChain chat model to use.
        prompt: The user prompt.
        system_prompt: System prompt for the LLM.
        max_retries: Number of retry attempts.

    Returns:
        The LLM's text response.

    Raises:
        ValueError: If all retries fail.
    """
    last_error = None

    for attempt in range(1, max_retries + 1):
        try:
            result = await llm.ainvoke([
                SystemMessage(content=system_prompt),
                HumanMessage(content=prompt),
            ])
            content = result.content if hasattr(result, "content") else str(result)
            if content and content.strip():
                return content.strip()

        except Exception as exc:
            last_error = exc
            logger.warning(
                f"[call_llm_text] Attempt {attempt}/{max_retries} failed: {exc}"
            )
            if attempt < max_retries:
                await asyncio.sleep(2 ** attempt)

    raise ValueError(f"Failed to get LLM text response after {max_retries} attempts. Last error: {last_error}")

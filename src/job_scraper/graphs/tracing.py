"""Structured logging and tracing utilities for LangGraph pipelines.

LangSmith tracing is automatic when LANGCHAIN_TRACING_V2=true is set.
This module adds lightweight structured logging alongside LangSmith
for terminal-level observability during development.
"""

import time
import logging
from functools import wraps
from typing import Any, Callable

logger = logging.getLogger("jobflow.graphs")


def log_node(node_name: str):
    """Decorator for graph node functions — logs entry/exit and duration.

    Usage:
        @log_node("parse_resume")
        def parse_resume(state: ResumeAnalysisState) -> dict:
            ...
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def async_wrapper(*args, **kwargs) -> Any:
            logger.info(f"[{node_name}] ▶ Starting...")
            start = time.perf_counter()
            try:
                result = await func(*args, **kwargs)
                elapsed = time.perf_counter() - start
                logger.info(f"[{node_name}] ✅ Completed in {elapsed:.1f}s")
                return result
            except Exception as exc:
                elapsed = time.perf_counter() - start
                logger.error(f"[{node_name}] ❌ Failed after {elapsed:.1f}s: {exc}")
                raise

        @wraps(func)
        def sync_wrapper(*args, **kwargs) -> Any:
            logger.info(f"[{node_name}] ▶ Starting...")
            start = time.perf_counter()
            try:
                result = func(*args, **kwargs)
                elapsed = time.perf_counter() - start
                logger.info(f"[{node_name}] ✅ Completed in {elapsed:.1f}s")
                return result
            except Exception as exc:
                elapsed = time.perf_counter() - start
                logger.error(f"[{node_name}] ❌ Failed after {elapsed:.1f}s: {exc}")
                raise

        import asyncio
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        return sync_wrapper

    return decorator


def setup_logging(level: int = logging.INFO) -> None:
    """Configure structured logging for the graphs module."""
    handler = logging.StreamHandler()
    handler.setFormatter(
        logging.Formatter(
            "%(asctime)s │ %(name)s │ %(message)s",
            datefmt="%H:%M:%S",
        )
    )
    root_logger = logging.getLogger("jobflow")
    root_logger.setLevel(level)
    if not root_logger.handlers:
        root_logger.addHandler(handler)

"""Structured logging via Loguru, routed through stdlib logging so uvicorn's
own access/error logs (and any library using `logging`, e.g. cmdstanpy) end
up in the same sink instead of two separate, differently-formatted streams.
"""
from __future__ import annotations

import logging
import sys
from pathlib import Path

from loguru import logger

_LOG_DIR = Path(__file__).parent / "logs"


class _InterceptHandler(logging.Handler):
    def emit(self, record: logging.LogRecord) -> None:
        try:
            level = logger.level(record.levelname).name
        except ValueError:
            level = record.levelno

        frame, depth = logging.currentframe(), 2
        while frame and frame.f_code.co_filename == logging.__file__:
            frame = frame.f_back
            depth += 1

        logger.opt(depth=depth, exception=record.exc_info).log(level, record.getMessage())


def configure_logging(level: str = "INFO") -> None:
    _LOG_DIR.mkdir(exist_ok=True)

    logger.remove()
    logger.add(sys.stderr, level=level, colorize=True)
    logger.add(
        _LOG_DIR / "app.jsonl",
        level=level,
        serialize=True,  # one JSON object per line — machine-parseable for Grafana/Loki later
        rotation="10 MB",
        retention="14 days",
    )

    # Root at WARNING, not 0/NOTSET — Great Expectations' internal logger in
    # particular emits a wall of INFO-level noise on import ("Skipping
    # registering function ... because it is a closure") that Python's
    # default root level (WARNING) already silences; forcing root to 0
    # would let it through. Uvicorn's own INFO logs (startup, access) are
    # explicitly re-enabled below since they're worth keeping.
    logging.basicConfig(handlers=[_InterceptHandler()], level=logging.WARNING, force=True)
    for noisy in ("uvicorn", "uvicorn.access", "uvicorn.error"):
        log = logging.getLogger(noisy)
        log.handlers = [_InterceptHandler()]
        log.setLevel(logging.INFO)

"""Webots perception stack: sensors, fusion, validation, mapping helpers."""

from __future__ import annotations

__all__ = ["__version__", "PerceptionPipeline"]

__version__ = "0.1.0"


def __getattr__(name: str):  # PEP 562 lazy exports
    if name == "PerceptionPipeline":
        from .pipeline import PerceptionPipeline as _PerceptionPipeline

        return _PerceptionPipeline
    raise AttributeError(name)

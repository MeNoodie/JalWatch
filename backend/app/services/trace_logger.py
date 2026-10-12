"""
JalWatch AI Trace Logger
========================
Lightweight, zero-dependency observability layer that captures every
agent reasoning step, tool call, janitor sweep, and HITL decision and
writes them to:

  1. A structured JSONL file  →  backend/.traces/jalwatch_traces.jsonl
  2. Console stdout           →  colored, human-readable log lines

No LangSmith / CloudWatch account required for the hackathon demo.
LangSmith can be drop-in enabled via three env vars:
  LANGSMITH_API_KEY, LANGCHAIN_PROJECT, LANGCHAIN_TRACING_V2=true

Usage:
    from app.services.trace_logger import emit_trace

    emit_trace(
        agent="cluster_intelligence_agent",
        event="tool_call",
        data={"tool": "get_cluster_details", "cluster_id": "clst_abc123"},
    )
"""

import json
import os
import traceback
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

_TRACES_DIR = Path(__file__).resolve().parent.parent.parent / ".traces"
_TRACES_DIR.mkdir(parents=True, exist_ok=True)
_TRACE_FILE = _TRACES_DIR / "jalwatch_traces.jsonl"

# Optional LangSmith integration — gracefully no-ops if keys are absent
_LANGSMITH_ENABLED: bool = False
_langsmith_client = None

def _try_init_langsmith():
    global _LANGSMITH_ENABLED, _langsmith_client
    api_key = os.getenv("LANGSMITH_API_KEY", "").strip()
    project  = os.getenv("LANGCHAIN_PROJECT", "jalwatch-hackathon").strip()
    tracing  = os.getenv("LANGCHAIN_TRACING_V2", "false").lower()

    if api_key and tracing == "true":
        try:
            from langsmith import Client  # type: ignore
            _langsmith_client = Client(api_key=api_key)
            _LANGSMITH_ENABLED = True
            print(f"[TraceLogger] LangSmith enabled → project: {project}")
        except Exception as exc:
            print(f"[TraceLogger] LangSmith init failed (skipping): {exc}")

_try_init_langsmith()

# ---------------------------------------------------------------------------
# ANSI colors for terminal readability
# ---------------------------------------------------------------------------

_LEVEL_COLORS = {
    "INFO":    "\033[96m",   # Cyan
    "SUCCESS": "\033[92m",   # Green
    "WARNING": "\033[93m",   # Yellow
    "ERROR":   "\033[91m",   # Red
    "AGENT":   "\033[95m",   # Magenta
}
_RESET = "\033[0m"


def _colorize(level: str, text: str) -> str:
    color = _LEVEL_COLORS.get(level.upper(), "")
    return f"{color}{text}{_RESET}"


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def emit_trace(
    agent: str,
    event: str,
    data: Optional[Dict[str, Any]] = None,
    level: str = "INFO",
    run_id: Optional[str] = None,
) -> str:
    """
    Emit a single structured trace event.

    Args:
        agent:   Logical agent name ("cluster_intelligence_agent", "janitor", "hitl", …)
        event:   Event type string ("tool_call", "sweep_complete", "analysis_ready", …)
        data:    Arbitrary JSON-serialisable payload dict.
        level:   Log severity: INFO | SUCCESS | WARNING | ERROR | AGENT
        run_id:  Optional correlation ID (generated if not supplied).

    Returns:
        The trace run_id string for correlation.
    """
    run_id = run_id or str(uuid.uuid4())[:8]
    ts = datetime.now(timezone.utc).isoformat()

    record: Dict[str, Any] = {
        "ts": ts,
        "run_id": run_id,
        "agent": agent,
        "event": event,
        "level": level.upper(),
        "data": data or {},
    }

    # --- 1. Write to JSONL file ---
    try:
        with _TRACE_FILE.open("a", encoding="utf-8") as f:
            f.write(json.dumps(record, default=str) + "\n")
    except Exception:
        pass  # Never let trace logging crash the application

    # --- 2. Console output ---
    label = f"[{agent.upper()}:{event}]"
    summary = json.dumps(data, default=str)[:120] if data else ""
    print(_colorize(level, f"[TRACE {run_id}] {ts} {label} {summary}"))

    # --- 3. Optional LangSmith run (fire-and-forget) ---
    if _LANGSMITH_ENABLED and _langsmith_client:
        try:
            project = os.getenv("LANGCHAIN_PROJECT", "jalwatch-hackathon")
            _langsmith_client.create_run(
                name=f"{agent}::{event}",
                run_type="chain",
                inputs=data or {},
                project_name=project,
                extra={"run_id": run_id, "level": level},
            )
        except Exception:
            pass  # LangSmith errors must never block the main flow

    return run_id


def get_recent_traces(n: int = 50) -> list:
    """
    Read the last `n` trace events from the JSONL file.
    Used by the admin /api/admin/traces endpoint for the demo dashboard.
    """
    try:
        if not _TRACE_FILE.exists():
            return []
        lines = _TRACE_FILE.read_text(encoding="utf-8").strip().splitlines()
        recent = lines[-n:] if len(lines) > n else lines
        return [json.loads(line) for line in reversed(recent)]
    except Exception:
        return []


def get_trace_stats() -> Dict[str, Any]:
    """Aggregate counts per agent and level for the observability dashboard."""
    traces = get_recent_traces(500)
    stats: Dict[str, int] = {}
    by_agent: Dict[str, int] = {}
    by_level: Dict[str, int] = {}
    for t in traces:
        agent = t.get("agent", "unknown")
        level = t.get("level", "INFO")
        by_agent[agent] = by_agent.get(agent, 0) + 1
        by_level[level] = by_level.get(level, 0) + 1

    return {
        "total_traces": len(traces),
        "by_agent": by_agent,
        "by_level": by_level,
        "langsmith_enabled": _LANGSMITH_ENABLED,
        "trace_file": str(_TRACE_FILE),
    }

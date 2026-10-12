"""
JalWatch Observability & Admin Utility Router
=============================================
Exposes endpoints for:
  - GET  /api/admin/traces          — Last N AI trace events (for live demo dashboard)
  - GET  /api/admin/traces/stats    — Aggregated trace counts by agent and level
  - POST /api/admin/janitor/run     — Manually trigger the 72-h janitor sweep
  - GET  /api/admin/janitor/preview — Preview which complaints would be archived (dry-run)

These endpoints are intentionally lightweight: no auth middleware so the
hackathon judges can hit them directly, but the routes are prefixed under
/api/admin to make the intent clear.
"""

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.complaint import Complaint
from app.services.trace_logger import emit_trace, get_recent_traces, get_trace_stats
from app.services.janitor import run_janitor_now, ARCHIVE_AFTER_HOURS

router = APIRouter(prefix="/api/admin", tags=["Observability & Admin"])


# ---------------------------------------------------------------------------
# AI Trace Observability
# ---------------------------------------------------------------------------

@router.get("/traces", summary="Live AI Agent Trace Events")
def list_traces(n: int = Query(50, ge=1, le=500)) -> List[Dict[str, Any]]:
    """
    Returns the last `n` structured trace events emitted by AI agents, the janitor,
    and system lifecycle hooks. Events are returned newest-first.

    Perfect for the hackathon demo: open this in a browser tab and refresh
    to watch agent reasoning in real time.
    """
    return get_recent_traces(n)


@router.get("/traces/stats", summary="AI Trace Statistics")
def traces_stats() -> Dict[str, Any]:
    """
    Returns aggregate counts of trace events grouped by agent name and severity level.
    Also reports whether LangSmith external forwarding is active.
    """
    return get_trace_stats()


# ---------------------------------------------------------------------------
# Janitor Controls
# ---------------------------------------------------------------------------

@router.post("/janitor/run", summary="Trigger 72-Hour Janitor Sweep Now")
def trigger_janitor() -> Dict[str, Any]:
    """
    Manually triggers the resolved-complaint archive sweep immediately.
    Useful for testing during the demo without waiting 30 minutes.

    Returns the number of complaints archived and clusters updated.
    """
    emit_trace(
        agent="janitor",
        event="manual_trigger",
        data={"triggered_by": "admin_api"},
        level="INFO",
    )
    result = run_janitor_now()
    return {
        "status": "sweep_complete",
        "archive_threshold_hours": ARCHIVE_AFTER_HOURS,
        **result,
    }


@router.get("/janitor/preview", summary="Preview Janitor Archive Candidates (Dry Run)")
def preview_janitor(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """
    Shows which resolved complaints are past the 72-hour window and would be
    archived on the next sweep — without actually changing anything.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(hours=ARCHIVE_AFTER_HOURS)

    candidates = (
        db.query(Complaint)
        .filter(
            Complaint.status == "resolved",
            Complaint.updated_at <= cutoff,
            Complaint.cluster_id.isnot(None),
        )
        .all()
    )

    upcoming = (
        db.query(Complaint)
        .filter(
            Complaint.status == "resolved",
            Complaint.updated_at > cutoff,
            Complaint.cluster_id.isnot(None),
        )
        .all()
    )

    return {
        "cutoff_utc": cutoff.isoformat(),
        "archive_threshold_hours": ARCHIVE_AFTER_HOURS,
        "ready_to_archive": [
            {
                "ticket_id": c.ticket_id,
                "cluster_id": c.cluster_id,
                "resolved_at": c.updated_at.isoformat() if c.updated_at else None,
                "hours_since_resolved": round(
                    (datetime.now(timezone.utc) - c.updated_at.replace(tzinfo=timezone.utc)).total_seconds() / 3600, 1
                ) if c.updated_at else None,
            }
            for c in candidates
        ],
        "pending_archive": [
            {
                "ticket_id": c.ticket_id,
                "hours_remaining": round(
                    ARCHIVE_AFTER_HOURS - (
                        (datetime.now(timezone.utc) - c.updated_at.replace(tzinfo=timezone.utc)).total_seconds() / 3600
                    ), 1
                ) if c.updated_at else ARCHIVE_AFTER_HOURS,
            }
            for c in upcoming
        ],
    }

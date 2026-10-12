"""
JalWatch Janitor Service — 72-Hour Auto-Archive Background Task
==============================================================
Automatically removes citizen-confirmed "resolved" complaints from their
cluster after 72 hours, recalculates cluster.complaint_count, and logs
every archive operation for observability.

Design:
  - Runs as a FastAPI lifespan asyncio background loop (no Celery required).
  - Wakes up every 30 minutes to scan for expired resolved complaints.
  - Emits structured trace events via the JalWatch trace logger.
  - Safe: never touches complaints resolved < 72 h ago; never crashes server.
"""

import asyncio
from datetime import datetime, timedelta, timezone
from typing import List

from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.models.complaint import Complaint
from app.models.cluster import Cluster

# How long to wait between janitor sweeps (seconds)
JANITOR_INTERVAL_SECONDS = 30 * 60  # 30 minutes

# How many hours after citizen marks resolved before auto-archive
ARCHIVE_AFTER_HOURS = 72


# ---------------------------------------------------------------------------
# Core DB function (synchronous, runs inside asyncio.to_thread)
# ---------------------------------------------------------------------------

def _archive_resolved_complaints() -> dict:
    """
    Scan DB, find resolved complaints older than 72 hours,
    unlink them from their cluster, recalculate complaint_count.
    Returns a result dict for trace logging.
    """
    from app.services.trace_logger import emit_trace  # lazy import avoids circularity

    db: Session = SessionLocal()
    archived_tickets: List[str] = []
    affected_clusters: List[str] = []

    try:
        cutoff = datetime.now(timezone.utc) - timedelta(hours=ARCHIVE_AFTER_HOURS)

        # Find all citizen-resolved complaints past the 72-h window
        # We match both status="resolved" and notification_message pattern
        resolved_complaints = (
            db.query(Complaint)
            .filter(
                Complaint.status == "resolved",
                Complaint.updated_at <= cutoff,
                Complaint.cluster_id.isnot(None),
            )
            .all()
        )

        if not resolved_complaints:
            emit_trace(
                agent="janitor",
                event="sweep_complete",
                data={"archived": 0, "message": "No expired resolved complaints found."},
            )
            return {"archived": 0, "clusters_updated": 0}

        # Collect affected cluster IDs before unlinking
        cluster_ids = list({c.cluster_id for c in resolved_complaints})

        for complaint in resolved_complaints:
            archived_tickets.append(complaint.ticket_id)
            # Unlink from cluster (keeps record for audit trail, just removes from active cluster)
            complaint.cluster_id = None
            complaint.status = "archived"
            complaint.notification_message = (
                "This complaint was automatically archived 72 hours after "
                "citizen confirmed the issue was resolved."
            )
            complaint.updated_at = datetime.now(timezone.utc)

        db.commit()

        # Recalculate complaint_count for each affected cluster
        for cluster_id in cluster_ids:
            cluster: Cluster | None = db.query(Cluster).filter(Cluster.id == cluster_id).first()
            if cluster:
                new_count = db.query(Complaint).filter(
                    Complaint.cluster_id == cluster_id
                ).count()
                cluster.complaint_count = new_count
                cluster.updated_at = datetime.now(timezone.utc)
                affected_clusters.append(cluster_id)

        db.commit()

        emit_trace(
            agent="janitor",
            event="sweep_complete",
            data={
                "archived": len(archived_tickets),
                "tickets": archived_tickets,
                "clusters_updated": len(affected_clusters),
                "cluster_ids": affected_clusters,
                "cutoff_utc": cutoff.isoformat(),
            },
        )

        return {
            "archived": len(archived_tickets),
            "clusters_updated": len(affected_clusters),
        }

    except Exception as exc:
        db.rollback()
        emit_trace(
            agent="janitor",
            event="sweep_error",
            data={"error": str(exc)},
            level="ERROR",
        )
        print(f"[JalWatch Janitor] ERROR during sweep: {exc}")
        return {"archived": 0, "error": str(exc)}
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Async background loop — started from FastAPI lifespan
# ---------------------------------------------------------------------------

async def start_janitor_loop():
    """
    Infinite async loop that runs the janitor sweep every 30 minutes.
    Designed to be launched as an asyncio Task from the FastAPI lifespan.
    """
    print(
        f"[JalWatch Janitor] Background janitor started. "
        f"Sweep interval: {JANITOR_INTERVAL_SECONDS // 60} min | "
        f"Archive threshold: {ARCHIVE_AFTER_HOURS}h after citizen confirms resolved."
    )

    while True:
        try:
            result = await asyncio.to_thread(_archive_resolved_complaints)
            if result.get("archived", 0) > 0:
                print(
                    f"[JalWatch Janitor] Archived {result['archived']} resolved complaint(s). "
                    f"Updated {result['clusters_updated']} cluster(s)."
                )
        except Exception as exc:
            print(f"[JalWatch Janitor] Unexpected loop error: {exc}")

        await asyncio.sleep(JANITOR_INTERVAL_SECONDS)


# ---------------------------------------------------------------------------
# Manual trigger endpoint helper (exposed via /api/admin/janitor/run)
# ---------------------------------------------------------------------------

def run_janitor_now() -> dict:
    """Synchronous trigger for the admin manual-run endpoint."""
    return _archive_resolved_complaints()

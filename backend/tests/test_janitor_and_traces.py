"""
Tests for:
  - 72-hour janitor sweep (auto-archive resolved complaints from clusters)
  - AI trace logger (emit_trace + get_recent_traces)
  - Observability API endpoints (/api/admin/traces, /api/admin/janitor/*)
"""
import pytest
from datetime import datetime, timedelta, timezone
from fastapi.testclient import TestClient
from app.main import app
from app.db.session import SessionLocal
from app.models.complaint import Complaint

client = TestClient(app)


# ==============================================================================
# Janitor Tests
# ==============================================================================

def _make_complaint(user_suffix: str, locality: str, lat: float = 28.7100, lng: float = 77.1000):
    """Helper: submit a complaint and return its ticket_id and cluster_id."""
    res = client.post("/api/complaints", json={
        "user_id": f"usr_janitor_test_{user_suffix}",
        "user_name": f"Citizen {user_suffix}",
        "latitude": lat,
        "longitude": lng,
        "locality_name": locality,
        "issue_category": "no_water",
        "description": f"Janitor test complaint {user_suffix}",
        "is_demo_data": True,
    })
    assert res.status_code == 201, f"Failed to create complaint: {res.text}"
    return res.json()["ticket_id"], res.json()["cluster_id"]


def test_janitor_preview_returns_valid_structure():
    """Janitor dry-run preview endpoint returns expected keys."""
    print("\n" + "=" * 70)
    print(" [JANITOR] Preview endpoint returns valid structure")
    print("=" * 70)

    res = client.get("/api/admin/janitor/preview")
    assert res.status_code == 200
    data = res.json()

    assert "cutoff_utc" in data
    assert "archive_threshold_hours" in data
    assert data["archive_threshold_hours"] == 72
    assert "ready_to_archive" in data
    assert "pending_archive" in data
    assert isinstance(data["ready_to_archive"], list)
    assert isinstance(data["pending_archive"], list)

    print(f"    [DONE] Janitor preview returned: "
          f"{len(data['ready_to_archive'])} ready to archive, "
          f"{len(data['pending_archive'])} pending.")
    print("=" * 70)


def test_janitor_run_now_archives_expired_resolved_complaints():
    """
    End-to-end: create a complaint, mark it resolved, manually backdate
    updated_at to 73 hours ago, run the janitor, and confirm it is archived.
    """
    print("\n" + "=" * 70)
    print(" [JANITOR] 72-hour auto-archive sweep test")
    print("=" * 70)

    # 1. Create a complaint
    ticket_id, cluster_id = _make_complaint("expire_01", "Paschim Vihar Ext", lat=28.6801, lng=77.0700)
    print(f" >> [CREATE] Ticket: {ticket_id}, Cluster: {cluster_id}")

    # 2. Mark it resolved via API
    patch_res = client.patch(f"/api/complaints/ticket/{ticket_id}", json={"status": "resolved"})
    assert patch_res.status_code == 200
    assert patch_res.json()["status"] == "resolved"
    print(f" >> [RESOLVE] Ticket marked as resolved.")

    # 3. Manually backdate updated_at to 73 hours ago (simulate 72+ hours passing)
    db = SessionLocal()
    try:
        complaint = db.query(Complaint).filter(Complaint.ticket_id == ticket_id).first()
        assert complaint is not None
        complaint.updated_at = datetime.now(timezone.utc) - timedelta(hours=73)
        db.commit()
        print(f" >> [BACKDATE] updated_at set to 73 hours ago — past the 72h threshold.")
    finally:
        db.close()

    # 4. Verify preview now shows it as ready to archive
    preview_res = client.get("/api/admin/janitor/preview")
    assert preview_res.status_code == 200
    ready = [r["ticket_id"] for r in preview_res.json()["ready_to_archive"]]
    assert ticket_id in ready, f"Expected {ticket_id} in ready_to_archive, got: {ready}"
    print(f" >> [PREVIEW] Ticket {ticket_id} appears in ready_to_archive list.")

    # 5. Run the janitor sweep
    run_res = client.post("/api/admin/janitor/run")
    assert run_res.status_code == 200
    run_data = run_res.json()
    assert run_data["archived"] >= 1
    print(f" >> [SWEEP] Janitor archived {run_data['archived']} complaints, "
          f"updated {run_data['clusters_updated']} cluster(s).")

    # 6. Verify complaint is now archived and unlinked from cluster
    db = SessionLocal()
    try:
        complaint = db.query(Complaint).filter(Complaint.ticket_id == ticket_id).first()
        assert complaint is not None
        assert complaint.status == "archived", f"Expected 'archived', got '{complaint.status}'"
        assert complaint.cluster_id is None, "cluster_id should be None after archiving"
        print(f" >> [VERIFY] Ticket {ticket_id}: status={complaint.status}, cluster_id={complaint.cluster_id}")
    finally:
        db.close()

    print("    [DONE] 72-hour auto-archive sweep fully verified!")
    print("=" * 70)


def test_janitor_does_not_archive_fresh_resolved_complaints():
    """Resolved complaints < 72 hours old must NOT be archived by the janitor."""
    print("\n" + "=" * 70)
    print(" [JANITOR] Fresh resolved complaints are NOT archived")
    print("=" * 70)

    ticket_id, _ = _make_complaint("fresh_01", "Rajouri Garden", lat=28.6420, lng=77.1160)

    # Mark resolved (updated_at = now, within 72h window)
    patch_res = client.patch(f"/api/complaints/ticket/{ticket_id}", json={"status": "resolved"})
    assert patch_res.status_code == 200

    # Run janitor
    run_res = client.post("/api/admin/janitor/run")
    assert run_res.status_code == 200

    # Complaint should still be "resolved", not "archived"
    db = SessionLocal()
    try:
        complaint = db.query(Complaint).filter(Complaint.ticket_id == ticket_id).first()
        assert complaint is not None
        assert complaint.status == "resolved", (
            f"Complaint should remain 'resolved' (not archived) when < 72h old, got: {complaint.status}"
        )
        print(f" >> [VERIFY] Ticket {ticket_id} remains 'resolved' (correctly NOT archived).")
    finally:
        db.close()

    print("    [DONE] Fresh resolved complaints correctly protected from premature archiving.")
    print("=" * 70)


# ==============================================================================
# AI Trace Logger Tests
# ==============================================================================

def test_trace_logger_emit_and_retrieve():
    """emit_trace writes to JSONL file and get_recent_traces returns it."""
    print("\n" + "=" * 70)
    print(" [TRACE LOGGER] emit_trace and get_recent_traces")
    print("=" * 70)

    from app.services.trace_logger import emit_trace, get_recent_traces

    run_id = emit_trace(
        agent="test_agent",
        event="unit_test_event",
        data={"key": "value_pytest_123"},
        level="INFO",
    )
    assert isinstance(run_id, str) and len(run_id) > 0, "run_id should be a non-empty string"

    traces = get_recent_traces(10)
    assert isinstance(traces, list)
    matching = [t for t in traces if t.get("event") == "unit_test_event"]
    assert len(matching) >= 1, "Expected at least 1 matching trace event"
    assert matching[0]["agent"] == "test_agent"
    assert matching[0]["data"].get("key") == "value_pytest_123"

    print(f"    [DONE] emit_trace + get_recent_traces verified. run_id={run_id}")
    print("=" * 70)


def test_trace_stats_returns_aggregates():
    """get_trace_stats returns aggregated counts by agent and level."""
    from app.services.trace_logger import emit_trace, get_trace_stats

    emit_trace(agent="stats_test_agent", event="stats_event", level="SUCCESS")
    stats = get_trace_stats()

    assert "total_traces" in stats
    assert "by_agent" in stats
    assert "by_level" in stats
    assert "langsmith_enabled" in stats
    assert stats["total_traces"] >= 1


# ==============================================================================
# Observability API Endpoint Tests
# ==============================================================================

def test_observability_traces_endpoint():
    """GET /api/admin/traces returns a list of trace dicts."""
    print("\n" + "=" * 70)
    print(" [OBSERVABILITY] GET /api/admin/traces")
    print("=" * 70)

    res = client.get("/api/admin/traces?n=20")
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    print(f"    [DONE] /api/admin/traces returned {len(data)} recent trace events.")
    print("=" * 70)


def test_observability_traces_stats_endpoint():
    """GET /api/admin/traces/stats returns stats dict with correct keys."""
    res = client.get("/api/admin/traces/stats")
    assert res.status_code == 200
    data = res.json()
    assert "total_traces" in data
    assert "by_agent" in data
    assert "by_level" in data
    assert "langsmith_enabled" in data

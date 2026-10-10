import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_submit_complaint_and_user_tracking():
    user_id = "usr_test_alpha_001"
    payload = {
        "user_id": user_id,
        "user_name": "Rohan Sharma",
        "latitude": 28.7041,
        "longitude": 77.1025,
        "locality_name": "Rohini Sector 7",
        "issue_category": "dirty_water",
        "description": "Muddy yellow water coming from municipal supply pipe.",
        "is_demo_data": False
    }

    # 1. Submit complaint
    res = client.post("/api/complaints", json=payload)
    assert res.status_code == 201
    data = res.json()
    assert "ticket_id" in data
    assert data["ticket_id"].startswith("TKT-JAL-")
    assert data["user_id"] == user_id
    assert data["cluster_id"] is not None

    ticket_id = data["ticket_id"]

    # 2. Query complaints for this specific user ID
    user_res = client.get(f"/api/complaints/user/{user_id}")
    assert user_res.status_code == 200
    user_complaints = user_res.json()
    assert len(user_complaints) >= 1
    assert any(c["ticket_id"] == ticket_id for c in user_complaints)

    # 3. Query complaint by ticket ID
    ticket_res = client.get(f"/api/complaints/ticket/{ticket_id}")
    assert ticket_res.status_code == 200
    assert ticket_res.json()["ticket_id"] == ticket_id

def test_cluster_agent_ten_complaints_trigger_and_hitl_notification():
    user_id = "usr_cluster_tester"
    cluster_lat, cluster_lng = 28.5355, 77.2612 # Okhla industrial area

    # Submit 10 complaints in the same cluster area
    last_res = None
    for i in range(10):
        res = client.post("/api/complaints", json={
            "user_id": f"{user_id}_{i}",
            "user_name": f"Citizen {i}",
            "latitude": cluster_lat + (i * 0.0001), # very close (~10m)
            "longitude": cluster_lng + (i * 0.0001),
            "locality_name": "Okhla Phase III",
            "issue_category": "dirty_water" if i < 8 else "bad_smell",
            "description": f"Contaminated water sample #{i} reported.",
            "is_demo_data": True
        })
        assert res.status_code == 201
        last_res = res.json()

    cluster_id = last_res["cluster_id"]
    assert cluster_id is not None

    # Check that cluster reached 10 complaints and triggered Agent 5-Point Analysis!
    cluster_res = client.get(f"/api/clusters/{cluster_id}")
    assert cluster_res.status_code == 200
    cluster_data = cluster_res.json()
    assert cluster_data["complaint_count"] >= 10
    assert cluster_data["agent_summary"] is not None
    summary = cluster_data["agent_summary"]
    assert "most_common_issues" in summary
    assert "spots_to_check" in summary
    assert "quick_action" in summary
    assert "root_cause_hypothesis" in summary
    assert "verification_recommendation" in summary

    # Now simulate Human-In-The-Loop (HITL) Government Action
    hitl_payload = {
        "gov_status": "team_dispatched",
        "gov_solution": "DJB mobile repair van dispatched; emergency potable tanker positioned at Main Gate.",
        "gov_officer_notes": "Identified drain seepage at joint 4B.",
        "notify_citizens": True
    }
    hitl_res = client.patch(f"/api/clusters/{cluster_id}/action", json=hitl_payload)
    assert hitl_res.status_code == 200
    updated_cluster = hitl_res.json()
    assert updated_cluster["gov_status"] == "team_dispatched"
    assert updated_cluster["gov_solution"] == hitl_payload["gov_solution"]

    # Verify that citizens in that cluster now have the official government notification!
    citizen_check = client.get(f"/api/complaints/user/{user_id}_0")
    assert citizen_check.status_code == 200
    my_complaint = citizen_check.json()[0]
    assert my_complaint["status"] == "action_taken"
    assert "Official Gov Action" in my_complaint["notification_message"]

import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_submit_complaint_and_user_tracking():
    print("\n" + "=" * 75)
    print(" [ACTION] CITIZEN COMPLAINT SUBMISSION & TICKET TRACKING")
    print("=" * 75)
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
    print(f" >> [SUBMIT] Citizen '{payload['user_name']}' submitting report in {payload['locality_name']}...")
    res = client.post("/api/complaints", json=payload)
    assert res.status_code == 201
    data = res.json()
    assert "ticket_id" in data
    assert data["ticket_id"].startswith("TKT-JAL-")
    assert data["user_id"] == user_id
    assert data["cluster_id"] is not None

    ticket_id = data["ticket_id"]
    cluster_id = data["cluster_id"]
    print(f"    [DONE] Complaint logged! Ticket ID: {ticket_id} (Assigned Cluster: {cluster_id})")

    # 2. Query complaints for this specific user ID
    print(f" >> [TRACKING] Citizen querying logged reports via User ID '{user_id}'...")
    user_res = client.get(f"/api/complaints/user/{user_id}")
    assert user_res.status_code == 200
    user_complaints = user_res.json()
    assert len(user_complaints) >= 1
    assert any(c["ticket_id"] == ticket_id for c in user_complaints)
    print(f"    [DONE] Retrieved {len(user_complaints)} complaints for user. Ticket ID matched.")

    # 3. Query complaint by ticket ID
    print(f" >> [TRACKING] Citizen tracking public status using Ticket ID '{ticket_id}'...")
    ticket_res = client.get(f"/api/complaints/ticket/{ticket_id}")
    assert ticket_res.status_code == 200
    assert ticket_res.json()["ticket_id"] == ticket_id
    print(f"    [DONE] Public ticket query verified. Current Status: {ticket_res.json()['status']}")
    print("=" * 75)

def test_cluster_agent_ten_complaints_trigger_and_hitl_notification():
    print("\n" + "=" * 75)
    print(" [ACTION] 10-COMPLAINT HOTSPOT THRESHOLD, AGENT INTELLIGENCE & CITIZEN NOTICE")
    print("=" * 75)
    user_id = "usr_cluster_tester"
    cluster_lat, cluster_lng = 28.5355, 77.2612 # Okhla industrial area

    # Submit 10 complaints in the same cluster area
    print(" >> [SEEDING] Submitting 10 localized complaints in Okhla Phase III (within 700m threshold)...")
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
    print(f"    [DONE] 10 complaints submitted. Active Hotspot Cluster: {cluster_id}")

    # Step 2: Check that cluster reached 10 complaints and triggered Agent 5-Point Analysis!
    print("\n" + "-" * 75)
    print(f" >> [CHECKING CLUSTER] Validating complaint threshold and auto-triggered agent synthesis...")
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

    print(f"    [DONE] Cluster Reached Threshold ({cluster_data['complaint_count']} Complaints).")
    print(f"           * Dominant Issue: {summary['most_common_issues'][:70]}...")
    print(f"           * Spots To Check: {summary['spots_to_check'][:70]}...")
    print(f"           * Quick Action:   {summary['quick_action'][:70]}...")

    # Step 3: Now simulate Human-In-The-Loop (HITL) Government Action
    print("\n" + "-" * 75)
    hitl_payload = {
        "gov_status": "team_dispatched",
        "gov_solution": "DJB mobile repair van dispatched; emergency potable tanker positioned at Main Gate.",
        "gov_officer_notes": "Identified drain seepage at joint 4B. Emergency low pressure flush initiated.",
        "notify_citizens": True
    }
    print(" >> [ASSIGN PERSON & ACTION] Government Administrator taking official action on cluster:")
    print(f"    - Gov Status:       {hitl_payload['gov_status']}")
    print(f"    - Official Action:  {hitl_payload['gov_solution']}")
    print(f"    - Officer Notes:    {hitl_payload['gov_officer_notes']}")
    print(f"    - Citizen Notice:   notify_citizens = True")

    hitl_res = client.patch(f"/api/clusters/{cluster_id}/action", json=hitl_payload)
    assert hitl_res.status_code == 200
    updated_cluster = hitl_res.json()
    assert updated_cluster["gov_status"] == "team_dispatched"
    assert updated_cluster["gov_solution"] == hitl_payload["gov_solution"]
    print(f"    [DONE] Government Action Successfully Stored in Cluster Record.")

    # Step 4: Verify that citizens in that cluster now have the official government notification!
    print("\n" + "-" * 75)
    print(" >> [NOTICE FOR CITIZEN] Verifying citizen tracking notification update across cluster:")
    citizen_check = client.get(f"/api/complaints/user/{user_id}_0")
    assert citizen_check.status_code == 200
    my_complaint = citizen_check.json()[0]
    assert my_complaint["status"] == "action_taken"
    assert "Official Gov Action" in my_complaint["notification_message"]

    print(f"    - Citizen Ticket:       {my_complaint['ticket_id']}")
    print(f"    - Live Status:          {my_complaint['status']}")
    print(f"    - Notification Notice:  {my_complaint['notification_message']}")
    print("    [DONE] Citizen Notice Confirmed: Citizen dashboard alerted with live resolution update!")
    print("=" * 75)

def test_citizen_update_problem_and_mark_solved():
    print("\n" + "=" * 75)
    print(" [ACTION] CITIZEN UPDATE PROBLEM & MARK ISSUE SOLVED (72HR AUTO-ARCHIVE)")
    print("=" * 75)

    # 1. Create a ticket
    res = client.post("/api/complaints", json={
        "user_id": "usr_resolve_tester",
        "user_name": "Citizen Vikas",
        "latitude": 28.6500,
        "longitude": 77.1000,
        "locality_name": "Tagore Garden",
        "issue_category": "dirty_water",
        "description": "Initial report: Tap water is rusty red.",
        "is_demo_data": True
    })
    assert res.status_code == 201
    ticket_id = res.json()["ticket_id"]
    print(f" >> [CREATE] Created ticket: {ticket_id}")

    # 2. Update problem description
    print(" >> [UPDATE PROBLEM] Citizen updating problem description...")
    upd_res = client.patch(f"/api/complaints/ticket/{ticket_id}", json={
        "description": "Updated report: Rusty color reduced but pungent chlorine smell persists."
    })
    assert upd_res.status_code == 200
    assert "pungent chlorine smell" in upd_res.json()["description"]
    print("    [DONE] Problem description updated successfully.")

    # 3. Mark issue solved
    print(" >> [ISSUE SOLVED] Citizen confirming issue is resolved...")
    solve_res = client.patch(f"/api/complaints/ticket/{ticket_id}", json={
        "status": "resolved"
    })
    assert solve_res.status_code == 200
    solved_data = solve_res.json()
    assert solved_data["status"] == "resolved"
    assert "72 hours" in solved_data["notification_message"]
    print(f"    [DONE] Ticket Status: {solved_data['status']}")
    print(f"           Notice:        {solved_data['notification_message']}")
    print("=" * 75)

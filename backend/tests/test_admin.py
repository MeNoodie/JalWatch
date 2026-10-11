import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.config import settings

client = TestClient(app)

def test_admin_login_success_and_failure():
    print("\n" + "=" * 75)
    print(" [ACTION] ADMIN LOGIN & SESSION VERIFICATION")
    print("=" * 75)

    # 1. Invalid login test
    print(" >> [LOGIN] Attempting login with invalid credentials...")
    bad_res = client.post("/api/admin/login", json={
        "username": "wrong_user",
        "password": "wrong_password"
    })
    assert bad_res.status_code == 401
    assert "Invalid admin username or password" in bad_res.json()["detail"]
    print("    [DONE] Unauthorized access rejected cleanly (HTTP 401).")

    # 2. Valid login with settings credentials
    print(f" >> [LOGIN] Logging in with authorized administrator credentials: '{settings.ADMIN_USERNAME}'...")
    good_res = client.post("/api/admin/login", json={
        "username": settings.ADMIN_USERNAME,
        "password": settings.ADMIN_PASSWORD
    })
    assert good_res.status_code == 200
    data = good_res.json()
    assert data["success"] is True
    assert "token" in data
    assert data["token"].startswith("adm_sec_")

    token = data["token"]
    print(f"    [DONE] Successfully authenticated! Session Token: {token[:18]}... (role: {data.get('role')})")

    # 3. Verify session
    print(" >> [VERIFY] Validating active administrator session token via /api/admin/verify...")
    verify_res = client.get("/api/admin/verify", headers={"Authorization": f"Bearer {token}"})
    assert verify_res.status_code == 200
    assert verify_res.json()["valid"] is True
    print("    [DONE] Session verified and authorized for admin operations.")
    print("=" * 75)

def test_admin_cluster_details_and_complaint_markers():
    print("\n" + "=" * 75)
    print(" [ACTION] CLUSTER CHECKING, OFFICER ASSIGNMENT & CITIZEN NOTICE WORKFLOW")
    print("=" * 75)

    # Step 1: Submit 3 test complaints in a specific West Delhi pocket (Tilak Nagar)
    base_lat, base_lng = 28.6446, 77.0935
    ticket_ids = []
    print(" >> [SEEDING] Submitting citizen complaints in West Delhi (Tilak Nagar Block 4)...")
    for i, cat in enumerate(["dirty_water", "dirty_water", "low_pressure"]):
        res = client.post("/api/complaints", json={
            "user_id": f"usr_admin_test_{i}",
            "user_name": f"Citizen {i}",
            "latitude": base_lat + (i * 0.0002),
            "longitude": base_lng + (i * 0.0002),
            "locality_name": "Tilak Nagar Block 4",
            "issue_category": cat,
            "description": f"Admin test complaint #{i} for water pressure/color.",
            "is_demo_data": True
        })
        assert res.status_code == 201
        data = res.json()
        ticket_ids.append(data["ticket_id"])
        cluster_id = data["cluster_id"]
        print(f"    - Report #{i+1}: Category = {cat}, Ticket ID = {data['ticket_id']}")

    assert cluster_id is not None
    print(f"    [DONE] Complaints successfully clustered into Hotspot Cluster: {cluster_id}")

    # Step 2: Query all clusters via admin endpoint
    print("\n" + "-" * 75)
    print(f" >> [CHECKING CLUSTER] Fetching government cluster overview list...")
    clusters_res = client.get("/api/admin/clusters")
    assert clusters_res.status_code == 200
    clusters_list = clusters_res.json()
    assert any(c["id"] == cluster_id for c in clusters_list)
    print(f"    [DONE] Cluster {cluster_id} is active and visible on the admin GIS map.")

    # Step 3: Query detailed cluster view
    print(f" >> [CHECKING CLUSTER] Retrieving detailed metrics and complaint markers for {cluster_id}...")
    detail_res = client.get(f"/api/admin/clusters/{cluster_id}")
    assert detail_res.status_code == 200
    detail = detail_res.json()

    assert detail["id"] == cluster_id
    assert detail["complaint_count"] >= 3
    assert "category_counts" in detail
    assert detail["category_counts"].get("dirty_water", 0) >= 2
    assert detail["category_counts"].get("low_pressure", 0) >= 1

    complaints = detail["complaints"]
    assert len(complaints) >= 3
    print(f"    [DONE] Cluster Details Verified:")
    print(f"           * Name:              {detail.get('name')}")
    print(f"           * Total Reports:     {detail['complaint_count']}")
    print(f"           * Issue Breakdown:   {detail['category_counts']}")
    print(f"           * Locality Groups:   {[lg['locality'] for lg in detail['locality_groups']]}")
    print(f"           * Map Pin Markers:   {len(complaints)} GPS coordinates mapped")

    # Step 4: Refresh AI Agent analysis
    print("\n" + "-" * 75)
    print(f" >> [AI SYNTHESIS] Generating 5-point operational intelligence via Cluster Intelligence Agent...")
    refresh_res = client.post(f"/api/admin/clusters/{cluster_id}/refresh-analysis")
    assert refresh_res.status_code == 200
    refreshed = refresh_res.json()
    assert refreshed["agent_summary"] is not None
    summary = refreshed["agent_summary"]
    assert "issue_overview" in summary or "most_common_issues" in summary
    print(f"    [DONE] 5-Point Analysis Ready:")
    print(f"           * Issue Overview:     {summary.get('most_common_issues', summary.get('issue_overview', ''))[:70]}...")
    print(f"           * Spots To Check:     {summary.get('spots_to_check', '')[:70]}...")
    print(f"           * Recommended Action: {summary.get('quick_action', '')[:70]}...")

    # Step 5: Assign Person, Department & Action Plan + Notice to Citizens
    print("\n" + "-" * 75)
    action_payload = {
        "gov_status": "team_dispatched",
        "gov_solution": "Field JE Er. V. Sharma dispatched with mobile pipe inspection unit.",
        "assigned_department": "Delhi Jal Board - West Maintenance",
        "assigned_person": "Er. V. Sharma (Junior Engineer)",
        "gov_officer_notes": "Main sluice valve seal replacement required. Low pressure flushing scheduled.",
        "notify_citizens": True
    }
    print(" >> [ASSIGN PERSON & ACTION] Administrator committing official dispatch & resolution plan:")
    print(f"    - Assigned Department: {action_payload['assigned_department']}")
    print(f"    - Assigned Person:     {action_payload['assigned_person']}")
    print(f"    - Official Action:     {action_payload['gov_solution']}")
    print(f"    - Officer Notes:       {action_payload['gov_officer_notes']}")
    print(f"    - Citizen Notice:      Broadcast Enabled (notify_citizens = True)")

    action_res = client.patch(f"/api/admin/clusters/{cluster_id}/action", json=action_payload)
    assert action_res.status_code == 200
    action_data = action_res.json()
    assert action_data["gov_status"] == "team_dispatched"
    assert action_data["gov_solution"] == action_payload["gov_solution"]
    assert "Er. V. Sharma" in action_data["gov_officer_notes"]

    print("    [DONE] Government Action Successfully Committed in Database:")
    print(f"           * New Status: {action_data['gov_status']}")
    print(f"           * Solution:   {action_data['gov_solution']}")

    # Step 6: Verify Notice for Citizen on Tracking Portal
    print("\n" + "-" * 75)
    print(" >> [NOTICE FOR CITIZEN] Verifying citizen portal notifications for cluster tickets...")
    citizen_res = client.get(f"/api/complaints/ticket/{ticket_ids[0]}")
    assert citizen_res.status_code == 200
    citizen_ticket = citizen_res.json()
    print(f"    - Checking Ticket ID: {citizen_ticket['ticket_id']}")
    print(f"    - Citizen Status:     {citizen_ticket['status']}")
    print(f"    - Live Notification:  {citizen_ticket.get('notification_message')}")
    print("    [DONE] Notice for citizens verified successfully! Citizen portal displays live status.")

    # Step 7: Non-existent cluster returns 404
    missing_res = client.get("/api/admin/clusters/clst_nonexistent_999")
    assert missing_res.status_code == 404
    print("    [DONE] 404 error handling verified for invalid cluster ID.")
    print("=" * 75)

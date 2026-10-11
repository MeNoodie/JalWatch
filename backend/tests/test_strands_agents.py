import json
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.agents.strands_config import get_active_provider_metadata
from app.agents.tools import (
    get_cluster_details,
    get_complaint_statistics,
    get_location_distribution,
    get_department_options
)
from app.agents.cluster_intelligence_agent import run_cluster_intelligence_agent
from app.agents.gov_action_assistant import run_gov_action_assistant

client = TestClient(app)

def test_strands_provider_metadata():
    metadata = get_active_provider_metadata()
    assert metadata["framework"] == "aws-strands-agents-1.59.0"
    assert "fallback_provider" in metadata
    assert metadata["analysis_version"] == "1.0"

def test_strands_readonly_tools_and_agent_a():
    print("\n" + "=" * 75)
    print(" [ACTION] AWS STRANDS AGENT A - CLUSTER INTELLIGENCE & READ-ONLY TOOLS")
    print("=" * 75)
    # 1. Create 3 test complaints in a cluster
    lat, lng = 28.6289, 77.0789 # Janakpuri
    print(" >> [SEEDING] Creating localized test complaints in Janakpuri District Centre...")
    for i in range(3):
        res = client.post("/api/complaints", json={
            "user_id": f"usr_strands_test_{i}",
            "user_name": f"Citizen {i}",
            "latitude": lat + (i * 0.0001),
            "longitude": lng + (i * 0.0001),
            "locality_name": "Janakpuri District Centre",
            "issue_category": "dirty_water" if i == 0 else "low_pressure",
            "description": f"Test report #{i} for Strands tool testing.",
            "is_demo_data": True
        })
        assert res.status_code == 201
        cluster_id = res.json()["cluster_id"]

    print(f"    [DONE] Complaints registered in Cluster: {cluster_id}")

    # 2. Test tool `get_cluster_details`
    print(f" >> [TOOL CALL] Executing `get_cluster_details('{cluster_id}')`...")
    details_raw = get_cluster_details(cluster_id)
    details = json.loads(details_raw)
    assert details["cluster_id"] == cluster_id
    assert details["complaint_count"] >= 3
    print(f"    [DONE] Details tool returned: {details['complaint_count']} complaints.")

    # 3. Test tool `get_complaint_statistics`
    print(f" >> [TOOL CALL] Executing `get_complaint_statistics('{cluster_id}')`...")
    stats_raw = get_complaint_statistics(cluster_id)
    stats = json.loads(stats_raw)
    assert stats["total_complaints"] >= 3
    assert "dirty_water" in stats["category_counts"]
    assert "low_pressure" in stats["category_counts"]
    print(f"    [DONE] Statistics tool returned: {stats['category_counts']}")

    # 4. Test tool `get_location_distribution`
    print(f" >> [TOOL CALL] Executing `get_location_distribution('{cluster_id}')`...")
    loc_raw = get_location_distribution(cluster_id)
    loc_data = json.loads(loc_raw)
    assert "Janakpuri District Centre" in loc_data["localities"]
    print(f"    [DONE] Location distribution tool verified: {loc_data['localities']}")

    # 5. Run Agent A (Cluster Intelligence Agent)
    print("\n" + "-" * 75)
    print(f" >> [RUN AGENT A] Executing Strands ClusterIntelligenceAgent for {cluster_id}...")
    agent_a_res = run_cluster_intelligence_agent(cluster_id)
    assert "issue_overview" in agent_a_res
    assert "geographic_distribution" in agent_a_res
    assert "category_frequency_patterns" in agent_a_res
    assert "priority_indicators" in agent_a_res
    assert "inspection_next_steps" in agent_a_res
    assert "metadata" in agent_a_res
    assert agent_a_res["metadata"]["framework"] == "aws-strands-agents-1.59.0"

    print(f"    [DONE] Agent A Execution Complete:")
    print(f"           * Issue Overview: {agent_a_res['issue_overview'][:70]}...")
    print(f"           * Priority:       {agent_a_res['priority_indicators'][:70]}...")
    print(f"           * Framework:      {agent_a_res['metadata']['framework']}")
    print("=" * 75)

def test_strands_agent_b_gov_action_assistant():
    print("\n" + "=" * 75)
    print(" [ACTION] AWS STRANDS AGENT B - GOVERNMENT ACTION ASSISTANT (ADVISORY)")
    print("=" * 75)
    lat, lng = 28.6720, 77.0895 # Paschim Vihar
    print(" >> [SEEDING] Submitting multi-category reports in Paschim Vihar Pocket B...")
    for i in range(2):
        res = client.post("/api/complaints", json={
            "user_id": f"usr_asst_test_{i}",
            "user_name": f"Citizen {i}",
            "latitude": lat + (i * 0.0001),
            "longitude": lng + (i * 0.0001),
            "locality_name": "Paschim Vihar Pocket B",
            "issue_category": "leakage" if i == 0 else "dirty_water",
            "description": f"Major street pipe leak #{i}.",
            "is_demo_data": True
        })
        assert res.status_code == 201
        cluster_id = res.json()["cluster_id"]

    print(f"    [DONE] Formed multi-category cluster: {cluster_id}")

    # 1. Test tool `get_department_options`
    print(f" >> [TOOL CALL] Executing `get_department_options('{cluster_id}')`...")
    dept_raw = get_department_options(cluster_id)
    dept_data = json.loads(dept_raw)
    depts = [d["department"] for d in dept_data["suggested_departments"]]
    assert any("Water Quality" in d for d in depts)
    assert any("Repair" in d for d in depts)
    print(f"    [DONE] Suggested departments: {depts}")

    # 2. Run Agent B (Government Action Assistant)
    print("\n" + "-" * 75)
    print(f" >> [RUN AGENT B] Invoking GovernmentActionAssistant advisory triage...")
    agent_b_res = run_gov_action_assistant(cluster_id)
    assert "recommended_departments" in agent_b_res
    assert len(agent_b_res["recommended_departments"]) >= 2 # multi-category
    assert "advisory_note" in agent_b_res
    assert "Final" in agent_b_res["advisory_note"] or "administrator" in agent_b_res["advisory_note"]

    print(f"    [DONE] Agent B Advisory Output:")
    print(f"           * Multi-Department Required: {agent_b_res.get('requires_multi_department')}")
    print(f"           * Action Steps:              {agent_b_res.get('proposed_action_steps')[:2]}")
    print(f"           * Advisory Guardrail:        {agent_b_res['advisory_note'][:75]}...")

    # 3. Test through HTTP API
    print(f" >> [API ENDPOINT] Testing /api/admin/clusters/{cluster_id}/assist-action...")
    http_res = client.post(f"/api/admin/clusters/{cluster_id}/assist-action")
    assert http_res.status_code == 200
    http_data = http_res.json()
    assert "recommended_departments" in http_data
    print("    [DONE] Assistant endpoint responded successfully.")
    print("=" * 75)

def test_strands_file_session_manager_context():
    """Verify that Strands FileSessionManager manages on-disk session state and retains context for clusters."""
    print("\n" + "=" * 75)
    print(" [ACTION] AWS STRANDS SESSION PERSISTENCE (FileSessionManager)")
    print("=" * 75)
    from strands import Agent
    from app.agents.strands_config import get_cluster_session_manager, STRANDS_SESSIONS_DIR, get_active_provider_metadata
    from strands.session import FileSessionManager

    cluster_id = "test_cluster_session_mgmt_001"
    sm = get_cluster_session_manager(cluster_id, "cluster_intel")
    assert isinstance(sm, FileSessionManager)
    assert sm.storage_dir == str(STRANDS_SESSIONS_DIR)

    # Initialize Agent with the session manager
    agent = Agent(
        session_manager=sm,
        name="TestContextAgent"
    )
    assert agent.session_id == sm.session_id
    assert "test_cluster_session_mgmt_001" in agent.session_id

    # Verify session directory is created on disk
    expected_session_dir = STRANDS_SESSIONS_DIR / f"session_{sm.session_id}"
    assert expected_session_dir.exists()

    # Verify message listing reads from filesystem cleanly
    messages = sm.list_messages(session_id=sm.session_id, agent_id=agent.agent_id)
    assert isinstance(messages, list)

    # Verify metadata exposes session_manager configuration
    meta = get_active_provider_metadata()
    assert meta["session_manager"] == "strands.session.FileSessionManager"

    print("    [DONE] Strands FileSessionManager persistence verified on local filesystem.")
    print("=" * 75)


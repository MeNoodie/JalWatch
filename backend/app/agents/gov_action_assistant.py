import json
from datetime import datetime, timezone
from typing import Dict, Any, List
from strands import Agent
from app.agents.strands_config import get_strands_model, get_cluster_session_manager
from app.agents.tools import (
    get_cluster_details,
    get_department_options,
    get_action_history,
    draft_action_plan
)
from app.db.session import SessionLocal
from app.models.cluster import Cluster
from app.models.complaint import Complaint

from app.prompts.prompts import (
    AGENT_B_SYSTEM_PROMPT,
    get_gov_action_user_prompt,
)

def deterministic_action_assistant(cluster: Cluster, complaints: list) -> Dict[str, Any]:
    """
    Deterministic rule-based action advisory based on complaint categories.
    """
    categories = set(c.issue_category for c in complaints)
    departments = []
    steps = []

    if "dirty_water" in categories or "bad_smell" in categories:
        departments.append({
            "department": "Delhi Jal Board - Water Quality Control Division",
            "rationale": "High contamination risk. Requires residual chlorine testing and sewer cross-contamination checks.",
            "urgency": "High"
        })
        steps.append("Collect water grab samples at distribution tail-ends for bacterial & turbidity analysis.")

    if "no_water" in categories or "low_pressure" in categories:
        departments.append({
            "department": "Delhi Jal Board - West Maintenance & Valve Operations",
            "rationale": "Supply flow interruption. Requires main transmission line pressure audit and valve chamber inspection.",
            "urgency": "Medium"
        })
        steps.append("Verify inlet valve pressure and check for unrecorded valve shutdowns.")

    if "leakage" in categories:
        departments.append({
            "department": "Delhi Jal Board - Emergency Pipe Repair Wing",
            "rationale": "Physical pipeline breach. Requires ground excavation and acoustic leak localization.",
            "urgency": "High"
        })
        steps.append("Dispatch acoustic leak detection team and repair excavation unit.")

    if "tanker_needed" in categories or len(complaints) >= 8:
        departments.append({
            "department": "Delhi Jal Board - Emergency Tanker Fleet",
            "rationale": "Potable water deficit. Emergency drinking water tankers required to mitigate citizen distress.",
            "urgency": "Immediate"
        })
        steps.append("Deploy mobile potable water tankers to high-density affected pockets.")

    if not departments:
        departments.append({
            "department": "Delhi Jal Board - West Grievance Cell",
            "rationale": "General municipal water grievance review.",
            "urgency": "Standard"
        })
        steps.append("Assign field Junior Engineer for on-site verification.")

    return {
        "cluster_id": cluster.id,
        "summary_of_situation": f"Cluster '{cluster.name}' has {len(complaints)} complaints across {len(categories)} categories ({', '.join(categories)}).",
        "recommended_departments": departments,
        "proposed_action_steps": steps,
        "requires_multi_department": len(departments) > 1,
        "advisory_note": "Advisory recommendation generated for administrative review. Final assignment and official action must be authorized by the administrator."
    }

def run_gov_action_assistant(cluster_id: str) -> Dict[str, Any]:
    """
    Runs the Government Action Assistant using Strands Agents SDK.
    Retrieves cluster context and department options, drafts an advisory plan,
    and returns recommendations for human review.
    """
    db = SessionLocal()
    try:
        cluster = db.query(Cluster).filter(Cluster.id == cluster_id).first()
        if not cluster:
            return {"error": f"Cluster '{cluster_id}' not found."}
            
        complaints = db.query(Complaint).filter(Complaint.cluster_id == cluster.id).all()
        model = get_strands_model()
        session_manager = get_cluster_session_manager(cluster_id, "gov_assistant")
        
        advisory_result = None

        if model is not None:
            try:
                agent = Agent(
                    model=model,
                    tools=[
                        get_cluster_details,
                        get_department_options,
                        get_action_history,
                        draft_action_plan
                    ],
                    system_prompt=AGENT_B_SYSTEM_PROMPT,
                    session_manager=session_manager,
                    name="GovernmentActionAssistant"
                )
                
                prompt = get_gov_action_user_prompt(cluster_id)
                response = agent(prompt)
                
                content = str(response).strip()
                if content.startswith("```json"):
                    content = content[7:]
                if content.startswith("```"):
                    content = content[3:]
                if content.endswith("```"):
                    content = content[:-3]
                content = content.strip()

                parsed = json.loads(content)
                if isinstance(parsed, dict) and "recommended_departments" in parsed:
                    advisory_result = parsed
            except Exception as e:
                print(f"[Strands GovActionAssistant] Invocation error: {e}. Utilizing deterministic fallback.")

        if not advisory_result:
            advisory_result = deterministic_action_assistant(cluster, complaints)

        return advisory_result
    finally:
        db.close()

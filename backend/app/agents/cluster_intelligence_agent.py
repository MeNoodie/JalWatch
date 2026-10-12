import json
from datetime import datetime, timezone
from typing import Dict, Any, Optional
from app.services.trace_logger import emit_trace
from strands import Agent
from app.agents.strands_config import (
    get_strands_model,
    get_active_provider_metadata,
    get_cluster_session_manager
)
from app.agents.tools import (
    get_cluster_details,
    get_complaint_statistics,
    get_location_distribution,
    get_historical_actions
)
from app.db.session import SessionLocal
from app.models.cluster import Cluster
from app.models.complaint import Complaint

from app.prompts.prompts import (
    AGENT_A_SYSTEM_PROMPT,
    get_cluster_intelligence_user_prompt,
)

def deterministic_cluster_analysis(cluster: Cluster, complaints: list) -> Dict[str, Any]:
    """
    Deterministic synthesis based strictly on verified database records.
    Used when external LLM is unconfigured, times out, or fails.
    """
    total = len(complaints)
    counts: Dict[str, int] = {}
    for c in complaints:
        counts[c.issue_category] = counts.get(c.issue_category, 0) + 1
        
    top_issue, top_count = max(counts.items(), key=lambda x: x[1]) if counts else ("water_issue", 0)
    pct = int((top_count / max(total, 1)) * 100)
    radius = int(cluster.radius_meters or 500)
    loc_names = list(set((c.locality_name or "").strip() for c in complaints if c.locality_name))
    loc_str = ", ".join(loc_names[:3]) if loc_names else cluster.name or "West Delhi Pocket"

    is_contamination = "dirty_water" in counts or "bad_smell" in counts
    priority_label = (
        "High Public Health Priority: Potential contamination / foul odor reported by citizens."
        if is_contamination else
        "Operational Supply Priority: Flow deficit / pressure fluctuations across distribution lines."
    )

    metadata = get_active_provider_metadata()
    metadata["is_fallback"] = True
    metadata["generated_at"] = datetime.now(timezone.utc).isoformat()

    return {
        "issue_overview": f"{top_issue.replace('_', ' ').title()} represents {pct}% of logged citizen reports ({top_count}/{total}) in {loc_str}.",
        "geographic_distribution": f"Complaints span an operational radius of ~{radius}m around ({cluster.center_lat:.4f}°N, {cluster.center_lng:.4f}°E). Reported pockets: {loc_str}.",
        "category_frequency_patterns": f"Dominant issue: {top_issue} ({top_count}). Category frequency: {', '.join(f'{k}: {v}' for k, v in counts.items())}.",
        "priority_indicators": f"{priority_label} Total of {total} grievances logged within the 700m Haversine cluster threshold.",
        "inspection_next_steps": f"Dispatch field technician to inspect distribution lines, sluice valves, and booster pumps within {radius}m of {loc_str}.",
        "most_common_issues": f"{top_issue.replace('_', ' ').title()} accounts for {pct}% of complaints ({top_count}/{total} logged reports in this pocket).",
        "spots_to_check": f"Inspect distribution pipeline junction and local valve chambers within ~{radius}m radius of {loc_str}.",
        "quick_action": f"Deploy emergency potable water tanker to {loc_str}; perform low-pressure flushing on tail-end line.",
        "root_cause_hypothesis": f"Hypothesis: Suspected negative-pressure suction leading to back-siphonage or joint breach during supply shutoff. Unconfirmed pending excavation.",
        "verification_recommendation": f"Collect 3 grab samples for turbidity & residual chlorine testing; inspect physical supply line before next distribution cycle.",
        "metadata": metadata
    }

def run_cluster_intelligence_agent(cluster_id: str) -> Dict[str, Any]:
    """
    Executes the Cluster Intelligence Agent using AWS Strands Agents SDK.
    Retrieves cluster context via read-only tools, invokes the model,
    and persists the 5-point analysis and provider metadata.
    """
    db = SessionLocal()
    try:
        cluster = db.query(Cluster).filter(Cluster.id == cluster_id).first()
        if not cluster:
            return {"error": f"Cluster '{cluster_id}' not found."}
            
        complaints = db.query(Complaint).filter(Complaint.cluster_id == cluster.id).all()
        model = get_strands_model()

        session_manager = get_cluster_session_manager(cluster_id, "cluster_intel")
        analysis_result = None

        if model is not None:
            run_id = emit_trace(
                agent="cluster_intelligence_agent",
                event="agent_start",
                data={"cluster_id": cluster_id, "complaint_count": len(complaints)},
                level="AGENT",
            )
            try:
                # Instantiate Strands Agent with read-only tools and FileSessionManager
                agent = Agent(
                    model=model,
                    tools=[
                        get_cluster_details,
                        get_complaint_statistics,
                        get_location_distribution,
                        get_historical_actions
                    ],
                    system_prompt=AGENT_A_SYSTEM_PROMPT,
                    session_manager=session_manager,
                    name="ClusterIntelligenceAgent"
                )
                
                prompt = get_cluster_intelligence_user_prompt(cluster_id)
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
                if isinstance(parsed, dict) and "most_common_issues" in parsed:
                    metadata = get_active_provider_metadata()
                    metadata["is_fallback"] = False
                    metadata["generated_at"] = datetime.now(timezone.utc).isoformat()
                    parsed["metadata"] = metadata
                    analysis_result = parsed
                    emit_trace(
                        agent="cluster_intelligence_agent",
                        event="analysis_ready",
                        data={"cluster_id": cluster_id, "most_common_issues": parsed.get("most_common_issues", "")[:120]},
                        level="SUCCESS",
                        run_id=run_id,
                    )
            except Exception as e:
                print(f"[Strands ClusterIntelligenceAgent] Invocation error: {e}. Utilizing deterministic fallback.")
                emit_trace(
                    agent="cluster_intelligence_agent",
                    event="agent_error",
                    data={"cluster_id": cluster_id, "error": str(e)},
                    level="ERROR",
                    run_id=run_id,
                )

        # If model failed or was not configured, use robust deterministic synthesis
        if not analysis_result:
            emit_trace(
                agent="cluster_intelligence_agent",
                event="deterministic_fallback",
                data={"cluster_id": cluster_id, "reason": "model_unavailable_or_failed"},
                level="WARNING",
            )
            analysis_result = deterministic_cluster_analysis(cluster, complaints)

        # Persist analysis in cluster record
        cluster.agent_summary = analysis_result
        cluster.last_agent_run_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(cluster)

        return analysis_result
    finally:
        db.close()

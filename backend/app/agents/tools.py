import json
from typing import Dict, Any, List
from strands import tool
from app.db.session import SessionLocal
from app.models.cluster import Cluster
from app.models.complaint import Complaint

@tool
def get_cluster_details(cluster_id: str) -> str:
    """
    Retrieves core geographic and operational metadata for a complaint cluster.
    
    Args:
        cluster_id: Unique identifier of the cluster hotspot.
    """
    db = SessionLocal()
    try:
        cluster = db.query(Cluster).filter(Cluster.id == cluster_id).first()
        if not cluster:
            return json.dumps({"error": f"Cluster '{cluster_id}' not found."})
        return json.dumps({
            "cluster_id": cluster.id,
            "name": cluster.name,
            "center_lat": round(cluster.center_lat, 5),
            "center_lng": round(cluster.center_lng, 5),
            "radius_meters": cluster.radius_meters or 500.0,
            "complaint_count": cluster.complaint_count,
            "dominant_issue": cluster.dominant_issue,
            "gov_status": cluster.gov_status,
            "last_agent_run_at": str(cluster.last_agent_run_at) if cluster.last_agent_run_at else None
        })
    finally:
        db.close()

@tool
def get_complaint_statistics(cluster_id: str) -> str:
    """
    Calculates deterministic category-wise counts, percentages, and volume for a cluster.
    
    Args:
        cluster_id: Unique identifier of the cluster hotspot.
    """
    db = SessionLocal()
    try:
        complaints = db.query(Complaint).filter(Complaint.cluster_id == cluster_id).all()
        total = len(complaints)
        if total == 0:
            return json.dumps({"total_complaints": 0, "categories": {}})
            
        counts: Dict[str, int] = {}
        for c in complaints:
            counts[c.issue_category] = counts.get(c.issue_category, 0) + 1
            
        percentages = {
            cat: round((count / total) * 100, 1)
            for cat, count in counts.items()
        }
        
        return json.dumps({
            "total_complaints": total,
            "category_counts": counts,
            "category_percentages": percentages,
            "dominant_category": max(counts.items(), key=lambda x: x[1])[0] if counts else None
        })
    finally:
        db.close()

@tool
def get_location_distribution(cluster_id: str) -> str:
    """
    Retrieves the verified geographic locality groupings and dispersion for complaints in a cluster.
    Never invents or fabricates locality names.
    
    Args:
        cluster_id: Unique identifier of the cluster hotspot.
    """
    db = SessionLocal()
    try:
        complaints = db.query(Complaint).filter(Complaint.cluster_id == cluster_id).all()
        if not complaints:
            return json.dumps({"localities": {}, "pockets_count": 0})
            
        locality_map: Dict[str, int] = {}
        sample_coords = []
        for c in complaints:
            loc = (c.locality_name or "").strip() or "General Vicinity"
            locality_map[loc] = locality_map.get(loc, 0) + 1
            if len(sample_coords) < 5:
                sample_coords.append({"lat": round(c.latitude, 5), "lng": round(c.longitude, 5)})
                
        return json.dumps({
            "localities": locality_map,
            "pockets_count": len(locality_map),
            "sample_coordinates": sample_coords
        })
    finally:
        db.close()

@tool
def get_historical_actions(cluster_id: str) -> str:
    """
    Retrieves previous official government actions, solutions, and officer notes for a cluster.
    
    Args:
        cluster_id: Unique identifier of the cluster hotspot.
    """
    db = SessionLocal()
    try:
        cluster = db.query(Cluster).filter(Cluster.id == cluster_id).first()
        if not cluster:
            return json.dumps({"error": f"Cluster '{cluster_id}' not found."})
        return json.dumps({
            "current_status": cluster.gov_status,
            "previous_solution": cluster.gov_solution,
            "officer_notes": cluster.gov_officer_notes,
            "last_action_timestamp": str(cluster.gov_action_timestamp) if cluster.gov_action_timestamp else None
        })
    finally:
        db.close()

@tool
def get_action_history(cluster_id: str) -> str:
    """Alias for get_historical_actions for government assistant workflow."""
    return get_historical_actions(cluster_id)

@tool
def get_department_options(cluster_id: str) -> str:
    """
    Evaluates verified complaint categories in a cluster and returns candidate municipal departments.
    Does NOT finalize or enforce an assignment; leaves choice to the administrative official.
    
    Args:
        cluster_id: Unique identifier of the cluster hotspot.
    """
    db = SessionLocal()
    try:
        complaints = db.query(Complaint).filter(Complaint.cluster_id == cluster_id).all()
        categories = set(c.issue_category for c in complaints)
        
        departments = []
        if "dirty_water" in categories or "bad_smell" in categories:
            departments.append({
                "department": "Delhi Jal Board - Water Quality Control & Testing Division",
                "relevance": "Handles sewage cross-contamination, water turbidity, chlorination, and grab testing.",
                "typical_action": "Conduct immediate residual chlorine testing and inspect sewer-water pipe cross-overs."
            })
        if "no_water" in categories or "low_pressure" in categories:
            departments.append({
                "department": "Delhi Jal Board - Pipeline Distribution & Valve Operations (West Zone)",
                "relevance": "Responsible for bulk transmission pressure, sluice valve regulation, and booster stations.",
                "typical_action": "Verify tail-end distribution line pressure and check for closed control valves."
            })
        if "leakage" in categories:
            departments.append({
                "department": "Delhi Jal Board - Emergency Pipe Repair & Maintenance Wing",
                "relevance": "Dispatches excavation repair vans for burst mains and joint sleeve replacement.",
                "typical_action": "Acoustic line leak detection and joint excavation."
            })
        if "tanker_needed" in categories or len(complaints) >= 8:
            departments.append({
                "department": "Delhi Jal Board - Emergency Water Tanker Dispatch Fleet",
                "relevance": "Provides immediate potable relief tankers to citizens pending pipeline repair.",
                "typical_action": "Deploy potable water tankers to primary affected pockets."
            })
            
        if not departments:
            departments.append({
                "department": "Delhi Jal Board - General Public Grievance Cell (West)",
                "relevance": "General municipal water supply oversight.",
                "typical_action": "Field verification by local Junior Engineer (JE)."
            })
            
        return json.dumps({
            "cluster_id": cluster_id,
            "categories_present": list(categories),
            "suggested_departments": departments
        })
    finally:
        db.close()

@tool
def draft_action_plan(cluster_id: str, selected_context: str) -> str:
    """
    Drafts a preliminary municipal response outline based on verified cluster context.
    For human officer review only; does not submit official action.
    
    Args:
        cluster_id: Unique identifier of the cluster hotspot.
        selected_context: Summary of selected departments or priorities.
    """
    return json.dumps({
        "cluster_id": cluster_id,
        "draft_plan": f"Preliminary action proposal: Coordinate with {selected_context} for on-site inspection within 24 hours.",
        "note": "Awaiting final review and officer assignment in admin portal."
    })

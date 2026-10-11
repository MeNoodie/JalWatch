from typing import List, Dict, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.cluster import Cluster
from app.models.complaint import Complaint
from app.schemas.admin import (
    AdminClusterSummaryItem,
    AdminClusterDetailResponse,
    AdminComplaintItem,
    LocalityGroup,
    AdminActionInput
)
from app.services.complaints import generate_agent_five_points
from app.api.login import verify_admin_token

router = APIRouter(prefix="/api/admin", tags=["Administration"])

def _build_cluster_detail(cluster: Cluster, db: Session) -> AdminClusterDetailResponse:
    complaints = db.query(Complaint).filter(Complaint.cluster_id == cluster.id).order_by(Complaint.created_at.desc()).all()
    
    # 1. Deterministic category breakdown directly from database
    category_counts: Dict[str, int] = {}
    for c in complaints:
        cat = c.issue_category
        category_counts[cat] = category_counts.get(cat, 0) + 1
        
    # 2. Deterministic locality groupings (using verified locality_name only)
    loc_map: Dict[str, List[str]] = {}
    for c in complaints:
        loc = (c.locality_name or "").strip() or "General Vicinity"
        loc_map.setdefault(loc, []).append(c.ticket_id)
        
    locality_groups = [
        LocalityGroup(locality=loc, count=len(tickets), ticket_ids=tickets)
        for loc, tickets in sorted(loc_map.items(), key=lambda x: len(x[1]), reverse=True)
    ]
    
    # 3. Individual complaints list with real coordinates (omitting private citizen credentials)
    complaint_items = [
        AdminComplaintItem(
            id=c.id,
            ticket_id=c.ticket_id,
            issue_category=c.issue_category,
            description=c.description,
            status=c.status,
            latitude=c.latitude,
            longitude=c.longitude,
            locality_name=c.locality_name,
            created_at=c.created_at
        )
        for c in complaints
    ]

    return AdminClusterDetailResponse(
        id=cluster.id,
        name=cluster.name,
        center_lat=cluster.center_lat,
        center_lng=cluster.center_lng,
        radius_meters=cluster.radius_meters or 500.0,
        complaint_count=len(complaints),
        dominant_issue=cluster.dominant_issue,
        gov_status=cluster.gov_status,
        gov_solution=cluster.gov_solution,
        gov_officer_notes=cluster.gov_officer_notes,
        gov_action_timestamp=cluster.gov_action_timestamp,
        agent_summary=cluster.agent_summary,
        last_agent_run_at=cluster.last_agent_run_at,
        created_at=cluster.created_at,
        updated_at=cluster.updated_at,
        category_counts=category_counts,
        locality_groups=locality_groups,
        complaints=complaint_items
    )

@router.get("/clusters", response_model=List[AdminClusterSummaryItem])
def list_admin_clusters(
    status: Optional[str] = Query(None, description="Optional status filter"),
    db: Session = Depends(get_db)
):
    """
    List all complaint hotspots with summary metadata for the admin map.
    """
    query = db.query(Cluster)
    if status and status != "all":
        query = query.filter(Cluster.gov_status == status)
    clusters = query.order_by(Cluster.complaint_count.desc()).all()
    
    return [
        AdminClusterSummaryItem(
            id=clst.id,
            name=clst.name,
            center_lat=clst.center_lat,
            center_lng=clst.center_lng,
            radius_meters=clst.radius_meters or 500.0,
            complaint_count=clst.complaint_count,
            dominant_issue=clst.dominant_issue,
            gov_status=clst.gov_status,
            gov_solution=clst.gov_solution,
            has_agent_summary=clst.agent_summary is not None,
            last_agent_run_at=clst.last_agent_run_at,
            created_at=clst.created_at,
            updated_at=clst.updated_at
        )
        for clst in clusters
    ]

@router.get("/clusters/{cluster_id}", response_model=AdminClusterDetailResponse)
def get_admin_cluster_details(cluster_id: str, db: Session = Depends(get_db)):
    """
    Retrieve comprehensive cluster intelligence:
    - Factual deterministic category counts
    - Saved 5-point analysis
    - Individual complaint coordinates and ticket pins
    - Locality distribution
    - Government action history
    """
    cluster = db.query(Cluster).filter(Cluster.id == cluster_id).first()
    if not cluster:
        raise HTTPException(status_code=404, detail="Cluster hotspot not found")
        
    return _build_cluster_detail(cluster, db)

@router.post("/clusters/{cluster_id}/refresh-analysis", response_model=AdminClusterDetailResponse)
def refresh_cluster_analysis(cluster_id: str, db: Session = Depends(get_db)):
    """
    Safely regenerate or update the 5-point AI analysis for this cluster.
    Idempotent and uses deterministic fallback if LLM is unavailable.
    """
    cluster = db.query(Cluster).filter(Cluster.id == cluster_id).first()
    if not cluster:
        raise HTTPException(status_code=404, detail="Cluster hotspot not found")
        
    complaints = db.query(Complaint).filter(Complaint.cluster_id == cluster.id).all()
    
    # Generate and persist analysis
    cluster.agent_summary = generate_agent_five_points(cluster, complaints)
    cluster.last_agent_run_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(cluster)
    
    return _build_cluster_detail(cluster, db)

@router.patch("/clusters/{cluster_id}/action", response_model=AdminClusterDetailResponse)
def apply_admin_action(
    cluster_id: str,
    action_in: AdminActionInput,
    db: Session = Depends(get_db)
):
    """
    Government official reviews cluster, assigns department/personnel,
    records official action notes, and broadcasts resolution status to citizens.
    """
    cluster = db.query(Cluster).filter(Cluster.id == cluster_id).first()
    if not cluster:
        raise HTTPException(status_code=404, detail="Cluster hotspot not found")
        
    notes_parts = []
    if action_in.assigned_department:
        notes_parts.append(f"Dept: {action_in.assigned_department}")
    if action_in.assigned_person:
        notes_parts.append(f"Assigned To: {action_in.assigned_person}")
    if action_in.gov_officer_notes:
        notes_parts.append(action_in.gov_officer_notes)
        
    combined_notes = " | ".join(notes_parts) if notes_parts else None

    cluster.gov_status = action_in.gov_status
    cluster.gov_solution = action_in.gov_solution
    cluster.gov_officer_notes = combined_notes
    cluster.gov_action_timestamp = datetime.now(timezone.utc)

    if action_in.notify_citizens:
        msg = f"Official Gov Action ({action_in.gov_status.replace('_', ' ').title()}): {action_in.gov_solution}"
        db.query(Complaint).filter(Complaint.cluster_id == cluster.id).update({
            Complaint.status: "action_taken" if action_in.gov_status != "resolved" else "resolved",
            Complaint.notification_message: msg
        })

    db.commit()
    db.refresh(cluster)
    return _build_cluster_detail(cluster, db)

@router.post("/clusters/{cluster_id}/assist-action")
def assist_admin_action(cluster_id: str):
    """
    Invokes Agent B (Government Action Assistant) via AWS Strands Agents SDK
    to draft multi-department triage suggestions for human review.
    Does NOT autonomously finalize or execute actions.
    """
    from app.agents.gov_action_assistant import run_gov_action_assistant
    return run_gov_action_assistant(cluster_id)


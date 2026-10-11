from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.schemas.complaint import (
    ComplaintCreate,
    ComplaintResponse,
    ComplaintUpdate,
    ClusterDetailResponse,
    ClusterHITLAction
)
from app.services.complaints import (
    create_complaint,
    get_user_complaints,
    get_complaint_by_ticket,
    update_citizen_complaint,
    list_complaints,
    update_cluster_hitl
)
from app.models.cluster import Cluster

router = APIRouter(prefix="/api", tags=["Complaints & Clusters"])

@router.post("/complaints", response_model=ComplaintResponse, status_code=201)
def submit_complaint(complaint_in: ComplaintCreate, db: Session = Depends(get_db)):
    """Citizen submits a grievance. Automatically assigns a ticket ID and maps to a cluster."""
    try:
        return create_complaint(db, complaint_in)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/complaints/user/{user_id}", response_model=List[ComplaintResponse])
def get_complaints_for_user(user_id: str, db: Session = Depends(get_db)):
    """Fetch all complaints submitted by this specific anonymous citizen ID."""
    return get_user_complaints(db, user_id)

@router.get("/complaints/ticket/{ticket_id}", response_model=ComplaintResponse)
def get_complaint_by_ticket_id(ticket_id: str, db: Session = Depends(get_db)):
    """Fetch complaint status by public ticket ID."""
    complaint = get_complaint_by_ticket(db, ticket_id)
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint ticket not found")
    return complaint

@router.patch("/complaints/ticket/{ticket_id}", response_model=ComplaintResponse)
def update_citizen_complaint_ticket(
    ticket_id: str,
    update_in: ComplaintUpdate,
    db: Session = Depends(get_db)
):
    """Citizen updates problem description or marks issue as solved (72hr auto-archive from cluster)."""
    updated = update_citizen_complaint(db, ticket_id, update_in)
    if not updated:
        raise HTTPException(status_code=404, detail="Complaint ticket not found")
    return updated

@router.get("/complaints", response_model=List[ComplaintResponse])
def get_all_complaints(
    skip: int = Query(0, ge=0),
    limit: int = Query(200, ge=1, le=500),
    category: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """List all complaints with optional filtering."""
    return list_complaints(db, skip=skip, limit=limit, category=category)

@router.get("/clusters", response_model=List[ClusterDetailResponse])
def get_all_clusters(db: Session = Depends(get_db)):
    """Retrieve all identified complaint clusters with agent 5-point analysis and gov action status."""
    return db.query(Cluster).order_by(Cluster.complaint_count.desc()).all()

@router.get("/clusters/{cluster_id}", response_model=ClusterDetailResponse)
def get_cluster_by_id(cluster_id: str, db: Session = Depends(get_db)):
    cluster = db.query(Cluster).filter(Cluster.id == cluster_id).first()
    if not cluster:
        raise HTTPException(status_code=404, detail="Cluster not found")
    return cluster

@router.patch("/clusters/{cluster_id}/action", response_model=ClusterDetailResponse)
def apply_government_action_to_cluster(
    cluster_id: str,
    action_in: ClusterHITLAction,
    db: Session = Depends(get_db)
):
    """
    Human-In-The-Loop (HITL) Government Action:
    Officer reviews cluster metadata & agent 5-point assessment, enters action/solution,
    and automatically notifies all citizens in the cluster.
    """
    updated_cluster = update_cluster_hitl(db, cluster_id, action_in)
    if not updated_cluster:
        raise HTTPException(status_code=404, detail="Cluster not found")
    return updated_cluster

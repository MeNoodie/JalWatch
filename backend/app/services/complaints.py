import math
import random
import string
from datetime import datetime, timezone
from typing import List, Optional
from sqlalchemy.orm import Session
from app.models.complaint import Complaint
from app.models.cluster import Cluster
from app.schemas.complaint import ComplaintCreate, ClusterHITLAction, ComplaintUpdate

def haversine_distance_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate the great circle distance between two points in meters."""
    R = 6371000 # Earth radius in meters
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = math.sin(delta_phi / 2.0) ** 2 + \
        math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return R * c

def generate_ticket_id() -> str:
    """Generate a clean, memorable citizen tracking ticket ID."""
    rand_chars = "".join(random.choices(string.ascii_uppercase + string.digits, k=5))
    return f"TKT-JAL-{rand_chars}"

def generate_agent_five_points(cluster: Cluster, complaints: List[Complaint]) -> dict:
    """
    Synthesize cluster records and produce the 5 required operational points:
    Uses AWS Strands Cluster Intelligence Agent with deterministic fallback.
    """
    try:
        from app.agents.cluster_intelligence_agent import run_cluster_intelligence_agent
        if cluster.id:
            res = run_cluster_intelligence_agent(cluster.id)
            if res and "most_common_issues" in res:
                return res
    except Exception as e:
        print(f"[Cluster Agent] Strands runner error: {e}. Falling back to llm_agent.")

    from app.services.llm_agent import analyze_cluster_with_llm
    complaints_data = [
        {"issue_category": c.issue_category, "description": c.description}
        for c in complaints
    ]
    locality = (complaints[0].locality_name if complaints else None) or f"Zone near ({round(cluster.center_lat, 3)}, {round(cluster.center_lng, 3)})"
    return analyze_cluster_with_llm(
        cluster_name=locality,
        radius_meters=cluster.radius_meters,
        center_coords=(cluster.center_lat, cluster.center_lng),
        complaints_data=complaints_data
    )


def find_or_create_cluster(db: Session, lat: float, lng: float, locality: Optional[str], initial_issue: str) -> Cluster:
    """Find an existing cluster within 700 meters or create a new cluster."""
    clusters = db.query(Cluster).all()
    matched_cluster = None

    for clst in clusters:
        dist = haversine_distance_meters(lat, lng, clst.center_lat, clst.center_lng)
        if dist <= 700.0:
            matched_cluster = clst
            break

    if not matched_cluster:
        name = locality or f"Cluster @ {round(lat, 3)}, {round(lng, 3)}"
        matched_cluster = Cluster(
            name=name,
            center_lat=lat,
            center_lng=lng,
            radius_meters=500.0,
            complaint_count=0,
            dominant_issue=initial_issue,
            gov_status="pending_review",
        )
        db.add(matched_cluster)
        db.commit()
        db.refresh(matched_cluster)

    return matched_cluster

def create_complaint(db: Session, complaint_in: ComplaintCreate) -> Complaint:
    ticket_id = generate_ticket_id()

    # Find or allocate cluster
    cluster = find_or_create_cluster(
        db,
        complaint_in.latitude,
        complaint_in.longitude,
        complaint_in.locality_name,
        complaint_in.issue_category
    )

    complaint = Complaint(
        ticket_id=ticket_id,
        user_id=complaint_in.user_id,
        user_name=complaint_in.user_name or "Anonymous Citizen",
        latitude=complaint_in.latitude,
        longitude=complaint_in.longitude,
        locality_name=complaint_in.locality_name,
        issue_category=complaint_in.issue_category,
        description=complaint_in.description,
        cluster_id=cluster.id,
        status="clustered",
        is_demo_data=complaint_in.is_demo_data,
        notification_message=cluster.gov_solution if cluster.gov_solution else "Ticket registered in local monitoring zone. Awaiting verification."
    )

    db.add(complaint)
    db.commit()
    db.refresh(complaint)

    # Update cluster statistics
    cluster.complaint_count = db.query(Complaint).filter(Complaint.cluster_id == cluster.id).count()

    # Determine dominant issue
    cluster_complaints = db.query(Complaint).filter(Complaint.cluster_id == cluster.id).all()
    issues = [c.issue_category for c in cluster_complaints]
    if issues:
        cluster.dominant_issue = max(set(issues), key=issues.count)

    # RULE: After every 10 complaints in each cluster, trigger Agent 5-Point Analysis!
    if cluster.complaint_count >= 10 and (cluster.complaint_count % 10 == 0 or not cluster.agent_summary):
        cluster.agent_summary = generate_agent_five_points(cluster, cluster_complaints)
        cluster.last_agent_run_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(complaint)
    return complaint

def get_user_complaints(db: Session, user_id: str) -> List[Complaint]:
    return db.query(Complaint).filter(Complaint.user_id == user_id).order_by(Complaint.created_at.desc()).all()

def get_complaint_by_ticket(db: Session, ticket_id: str) -> Optional[Complaint]:
    return db.query(Complaint).filter(Complaint.ticket_id == ticket_id).first()

def list_complaints(db: Session, skip: int = 0, limit: int = 200, category: Optional[str] = None) -> List[Complaint]:
    query = db.query(Complaint)
    if category:
        query = query.filter(Complaint.issue_category == category)
    return query.order_by(Complaint.created_at.desc()).offset(skip).limit(limit).all()

def update_cluster_hitl(db: Session, cluster_id: str, action_in: ClusterHITLAction) -> Optional[Cluster]:
    """Human-In-The-Loop government officer reviews cluster and updates solution, notifying all citizens."""
    cluster = db.query(Cluster).filter(Cluster.id == cluster_id).first()
    if not cluster:
        return None

    cluster.gov_status = action_in.gov_status
    cluster.gov_solution = action_in.gov_solution
    cluster.gov_officer_notes = action_in.gov_officer_notes
    cluster.gov_action_timestamp = datetime.now(timezone.utc)

    if action_in.notify_citizens:
        # Broadcast decision to all complaints in this cluster
        db.query(Complaint).filter(Complaint.cluster_id == cluster.id).update({
            Complaint.status: "action_taken",
            Complaint.notification_message: f"Official Gov Action ({action_in.gov_status.replace('_', ' ').title()}): {action_in.gov_solution}"
        })

    db.commit()
    db.refresh(cluster)
    return cluster

def update_citizen_complaint(db: Session, ticket_id: str, update_in: ComplaintUpdate) -> Optional[Complaint]:
    """Allows citizen to update grievance description or mark issue as solved (72hr auto-archive)."""
    complaint = db.query(Complaint).filter(Complaint.ticket_id == ticket_id).first()
    if not complaint:
        return None

    if update_in.description is not None:
        complaint.description = update_in.description.strip()

    if update_in.status is not None:
        complaint.status = update_in.status.strip()
        if update_in.status == "resolved":
            complaint.notification_message = (
                update_in.notification_message or
                "Issue confirmed solved by citizen. Scheduled for auto-removal from active cluster after 72 hours."
            )
        elif update_in.notification_message is not None:
            complaint.notification_message = update_in.notification_message

    complaint.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(complaint)
    return complaint

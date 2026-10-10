import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Float, Integer, Text, DateTime, JSON
from app.db.session import Base

class Cluster(Base):
    __tablename__ = "clusters"

    id = Column(String(64), primary_key=True, default=lambda: f"clst_{uuid.uuid4().hex[:8]}")
    name = Column(String(128), nullable=True) # e.g. "Rohini Sector 7 Hotspot"
    center_lat = Column(Float, nullable=False)
    center_lng = Column(Float, nullable=False)
    radius_meters = Column(Float, default=500.0)
    complaint_count = Column(Integer, default=0)
    dominant_issue = Column(String(64), nullable=True)

    # Agent 5-Point Analysis (Updated after every 10 complaints)
    # Structure: {
    #   "most_common_issues": "...",
    #   "spots_to_check": "...",
    #   "quick_action": "...",
    #   "root_cause_hypothesis": "...",
    #   "verification_recommendation": "..."
    # }
    agent_summary = Column(JSON, nullable=True)
    last_agent_run_at = Column(DateTime, nullable=True)

    # Human-In-The-Loop (HITL) Government Action & Decision
    gov_status = Column(String(64), default="pending_review") # pending_review, team_dispatched, investigation_active, resolved
    gov_solution = Column(Text, nullable=True) # e.g. "Water tanker deployed to Pocket B; valve pressure regulator replaced."
    gov_officer_notes = Column(Text, nullable=True)
    gov_action_timestamp = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

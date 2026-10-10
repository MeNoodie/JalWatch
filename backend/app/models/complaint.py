import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Float, Text, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.db.session import Base

class Complaint(Base):
    __tablename__ = "complaints"

    id = Column(String(64), primary_key=True, default=lambda: str(uuid.uuid4()))
    ticket_id = Column(String(32), unique=True, index=True, nullable=False)
    user_id = Column(String(64), index=True, nullable=False) # Persistent client-side ID
    user_name = Column(String(128), default="Anonymous Citizen")
    
    # Location
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    locality_name = Column(String(128), nullable=True)

    # Details
    issue_category = Column(String(64), nullable=False)
    description = Column(Text, nullable=False)

    # Status & Workflow
    status = Column(String(64), default="submitted") # submitted, clustered, investigating, action_taken, resolved
    cluster_id = Column(String(64), ForeignKey("clusters.id"), nullable=True)

    # Feedback / Notification to citizen from government decision
    notification_message = Column(Text, nullable=True)

    # Demo separation
    is_demo_data = Column(Boolean, default=False)

    # Automatic UTC Timestamp
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

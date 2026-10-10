from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, field_validator, ConfigDict

ALLOWED_CATEGORIES = [
    "dirty_water",
    "low_pressure",
    "no_water",
    "leakage",
    "bad_smell",
    "tanker_needed",
    "other"
]

class ComplaintCreate(BaseModel):
    user_id: str = Field(..., min_length=4, max_length=64, description="Persistent anonymous client ID")
    user_name: Optional[str] = Field("Anonymous Citizen", max_length=128)
    latitude: float = Field(..., ge=-90.0, le=90.0)
    longitude: float = Field(..., ge=-180.0, le=180.0)
    locality_name: Optional[str] = Field(None, max_length=128)
    issue_category: str = Field(...)
    description: str = Field(..., min_length=5, max_length=1000)
    is_demo_data: bool = Field(False)

    @field_validator("issue_category")
    @classmethod
    def validate_category(cls, value: str) -> str:
        clean = value.strip().lower()
        if clean not in ALLOWED_CATEGORIES:
            raise ValueError(f"Invalid category '{clean}'. Allowed: {', '.join(ALLOWED_CATEGORIES)}")
        return clean

class ComplaintResponse(BaseModel):
    id: str
    ticket_id: str
    user_id: str
    user_name: Optional[str]
    latitude: float
    longitude: float
    locality_name: Optional[str]
    issue_category: str
    description: str
    status: str
    cluster_id: Optional[str] = None
    notification_message: Optional[str] = None
    is_demo_data: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class ClusterHITLAction(BaseModel):
    gov_status: str = Field(..., description="e.g. action_dispatched, inspection_scheduled, resolved")
    gov_solution: str = Field(..., min_length=5, max_length=1000, description="Action taken or scheduled by government")
    gov_officer_notes: Optional[str] = Field(None, max_length=1000)
    notify_citizens: bool = Field(True, description="Whether to send notification message to all citizens in this cluster")

class ClusterDetailResponse(BaseModel):
    id: str
    name: Optional[str]
    center_lat: float
    center_lng: float
    radius_meters: float
    complaint_count: int
    dominant_issue: Optional[str]
    agent_summary: Optional[Dict[str, Any]] = None
    last_agent_run_at: Optional[datetime] = None
    gov_status: str
    gov_solution: Optional[str] = None
    gov_officer_notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

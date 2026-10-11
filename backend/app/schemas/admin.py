from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, ConfigDict

class AdminComplaintItem(BaseModel):
    id: str
    ticket_id: str
    issue_category: str
    description: str
    status: str
    latitude: float
    longitude: float
    locality_name: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class LocalityGroup(BaseModel):
    locality: str
    count: int
    ticket_ids: List[str]

class AdminClusterDetailResponse(BaseModel):
    id: str
    name: Optional[str]
    center_lat: float
    center_lng: float
    radius_meters: float
    complaint_count: int
    dominant_issue: Optional[str]
    gov_status: str
    gov_solution: Optional[str] = None
    gov_officer_notes: Optional[str] = None
    gov_action_timestamp: Optional[datetime] = None
    agent_summary: Optional[Dict[str, Any]] = None
    last_agent_run_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    
    # Deterministic analytics
    category_counts: Dict[str, int]
    locality_groups: List[LocalityGroup]
    
    # Individual complaint coordinates & details
    complaints: List[AdminComplaintItem]

    model_config = ConfigDict(from_attributes=True)

class AdminClusterSummaryItem(BaseModel):
    id: str
    name: Optional[str]
    center_lat: float
    center_lng: float
    radius_meters: float
    complaint_count: int
    dominant_issue: Optional[str]
    gov_status: str
    gov_solution: Optional[str] = None
    has_agent_summary: bool
    last_agent_run_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

class AdminActionInput(BaseModel):
    gov_status: str = Field(..., description="e.g. pending_review, team_dispatched, investigation_active, resolved")
    gov_solution: str = Field(..., min_length=3, max_length=1000)
    gov_officer_notes: Optional[str] = Field(None, max_length=1000)
    assigned_department: Optional[str] = Field(None, max_length=128)
    assigned_person: Optional[str] = Field(None, max_length=128)
    notify_citizens: bool = Field(True)

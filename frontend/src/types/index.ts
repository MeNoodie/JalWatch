export type IssueCategory =
  | 'dirty_water'
  | 'low_pressure'
  | 'no_water'
  | 'leakage'
  | 'bad_smell'
  | 'tanker_needed'
  | 'other';

export interface Complaint {
  id: string;
  ticket_id: string;
  user_id: string;
  user_name?: string;
  latitude: number;
  longitude: number;
  locality_name?: string;
  issue_category: IssueCategory;
  description: string;
  status: 'submitted' | 'clustered' | 'investigating' | 'action_taken' | 'resolved';
  cluster_id?: string;
  notification_message?: string;
  is_demo_data: boolean;
  created_at: string;
}

export interface ComplaintCreateInput {
  user_id: string;
  user_name?: string;
  latitude: number;
  longitude: number;
  locality_name?: string;
  issue_category: IssueCategory;
  description: string;
  is_demo_data?: boolean;
}

export interface AgentSummary {
  most_common_issues?: string;
  spots_to_check?: string;
  quick_action?: string;
  root_cause_hypothesis?: string;
  verification_recommendation?: string;
}

export interface Cluster {
  id: string;
  name?: string;
  center_lat: number;
  center_lng: number;
  radius_meters: number;
  complaint_count: number;
  dominant_issue?: string;
  agent_summary?: AgentSummary;
  last_agent_run_at?: string;
  gov_status: 'pending_review' | 'team_dispatched' | 'inspection_scheduled' | 'action_taken' | 'resolved';
  gov_solution?: string;
  gov_officer_notes?: string;
  created_at: string;
  updated_at: string;
}

export interface GovActionInput {
  gov_status: string;
  gov_solution: string;
  gov_officer_notes?: string;
  notify_citizens: boolean;
}

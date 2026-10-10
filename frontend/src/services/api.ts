import { Complaint, ComplaintCreateInput, Cluster, GovActionInput } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export interface HealthResponse {
  status: string;
  app: string;
  environment: string;
}

export async function checkBackendHealth(): Promise<HealthResponse> {
  const response = await fetch(`${API_BASE_URL}/health`);
  if (!response.ok) {
    throw new Error(`Health check failed: HTTP ${response.status}`);
  }
  return response.json();
}

export async function submitComplaint(input: ComplaintCreateInput): Promise<Complaint> {
  const response = await fetch(`${API_BASE_URL}/api/complaints`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to submit complaint: HTTP ${response.status}`);
  }
  return response.json();
}

export async function fetchUserComplaints(userId: string): Promise<Complaint[]> {
  const response = await fetch(`${API_BASE_URL}/api/complaints/user/${encodeURIComponent(userId)}`);
  if (!response.ok) {
    throw new Error(`Failed to load user grievances: HTTP ${response.status}`);
  }
  return response.json();
}

export async function fetchTicketDetails(ticketId: string): Promise<Complaint> {
  const response = await fetch(`${API_BASE_URL}/api/complaints/ticket/${encodeURIComponent(ticketId)}`);
  if (!response.ok) {
    throw new Error(`Ticket not found: HTTP ${response.status}`);
  }
  return response.json();
}

export async function fetchClusters(): Promise<Cluster[]> {
  const response = await fetch(`${API_BASE_URL}/api/clusters`);
  if (!response.ok) {
    throw new Error(`Failed to load clusters: HTTP ${response.status}`);
  }
  return response.json();
}

export async function applyGovClusterAction(clusterId: string, action: GovActionInput): Promise<Cluster> {
  const response = await fetch(`${API_BASE_URL}/api/clusters/${encodeURIComponent(clusterId)}/action`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(action),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to apply government action: HTTP ${response.status}`);
  }
  return response.json();
}

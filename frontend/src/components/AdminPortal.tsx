import React, { useState } from 'react';
import {
  AdminClusterDetail,
  AdminComplaintItem,
  GovAssistantResult,
  AdminLoginResult,
} from '../types';
import {
  adminLogin,
  refreshClusterAnalysis,
  fetchGovActionAssistance,
  submitAdminAction,
} from '../services/api';

interface AdminPortalProps {
  isAdminLoggedIn: boolean;
  onLoginSuccess: (user: AdminLoginResult) => void;
  onLogout: () => void;
  selectedCluster: AdminClusterDetail | null;
  onCloseCluster: () => void;
  onClusterUpdated: (updated: AdminClusterDetail) => void;
  onFocusComplaint: (complaint: AdminComplaintItem) => void;
  focusedComplaintId?: string | null;
}

export function AdminPortal({
  isAdminLoggedIn,
  onLoginSuccess,
  onLogout,
  selectedCluster,
  onCloseCluster,
  onClusterUpdated,
  onFocusComplaint,
  focusedComplaintId,
}: AdminPortalProps) {
  // Login form state
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);

  // Cluster action state
  const [govStatus, setGovStatus] = useState<string>('team_dispatched');
  const [assignedDept, setAssignedDept] = useState<string>('Delhi Jal Board - West Maintenance');
  const [assignedPerson, setAssignedPerson] = useState<string>('Er. V. Sharma (JE)');
  const [solutionNotes, setSolutionNotes] = useState<string>('');
  const [officerNotes, setOfficerNotes] = useState<string>('');
  const [submittingAction, setSubmittingAction] = useState(false);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  // Strands AI State
  const [refreshingAnalysis, setRefreshingAnalysis] = useState(false);
  const [govAssistance, setGovAssistance] = useState<GovAssistantResult | null>(null);
  const [loadingAssistance, setLoadingAssistance] = useState(false);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoggingIn(true);
    try {
      const res = await adminLogin(username, password);
      onLoginSuccess(res);
      setPassword('');
    } catch (err: any) {
      setLoginError(err.message || 'Login failed.');
    } finally {
      setLoggingIn(false);
    }
  };

  const handleRefreshAnalysis = async () => {
    if (!selectedCluster) return;
    setRefreshingAnalysis(true);
    try {
      const res = await refreshClusterAnalysis(selectedCluster.id);
      onClusterUpdated(res);
    } catch (err: any) {
      alert(`Analysis refresh error: ${err.message}`);
    } finally {
      setRefreshingAnalysis(false);
    }
  };

  const handleRequestAssistance = async () => {
    if (!selectedCluster) return;
    setLoadingAssistance(true);
    try {
      const res = await fetchGovActionAssistance(selectedCluster.id);
      setGovAssistance(res);
    } catch (err: any) {
      alert(`Assistant error: ${err.message}`);
    } finally {
      setLoadingAssistance(false);
    }
  };

  const handleActionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCluster || !solutionNotes.trim()) return;
    setSubmittingAction(true);
    setActionSuccessMsg(null);
    try {
      const updated = await submitAdminAction(selectedCluster.id, {
        gov_status: govStatus,
        gov_solution: solutionNotes,
        assigned_department: assignedDept,
        assigned_person: assignedPerson,
        gov_officer_notes: officerNotes,
        notify_citizens: true,
      });
      onClusterUpdated(updated);
      setActionSuccessMsg('Official action registered and citizens notified!');
      setTimeout(() => setActionSuccessMsg(null), 4000);
    } catch (err: any) {
      alert(`Action error: ${err.message}`);
    } finally {
      setSubmittingAction(false);
    }
  };

  // ─── If not logged in, render Login Modal ───
  if (!isAdminLoggedIn) {
    return (
      <div className="admin-modal-overlay">
        <div className="admin-login-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <span style={{ fontSize: '24px' }}>🛡️</span>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'white' }}>JalWatch Municipal Admin</h3>
              <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Government Operations & Cluster Triage
              </p>
            </div>
          </div>

          <form onSubmit={handleLoginSubmit}>
            {loginError && (
              <div style={{ background: '#7f1d1d', border: '1px solid #ef4444', color: '#fca5a5', padding: '8px 12px', borderRadius: '6px', fontSize: '0.8rem', marginBottom: '12px' }}>
                {loginError}
              </div>
            )}
            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                Admin Username
              </label>
              <input
                type="text"
                className="form-input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                Password (from .env)
              </label>
              <input
                type="password"
                className="form-input"
                placeholder="Enter admin password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary btn-block"
              disabled={loggingIn}
            >
              {loggingIn ? 'Authenticating...' : 'Sign In as Officer'}
            </button>
          </form>
          <div style={{ marginTop: '12px', fontSize: '0.72rem', color: 'var(--text-dim)', textAlign: 'center' }}>
            Credentials configured in server <code>.env</code>
          </div>
        </div>
      </div>
    );
  }

  // ─── If logged in and cluster selected, render Inspector Drawer ───
  if (!selectedCluster) return null;

  const analysis = selectedCluster.agent_summary || {};
  const metadata = analysis.metadata || {};

  return (
    <div className="admin-cluster-drawer">
      {/* Header */}
      <div className="drawer-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '18px' }}>📍</span>
            <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'white' }}>
              {selectedCluster.name || 'Complaint Hotspot'}
            </h3>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            ID: <code>{selectedCluster.id}</code> · {selectedCluster.center_lat.toFixed(4)}°N, {selectedCluster.center_lng.toFixed(4)}°E
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={onLogout}
            title="Sign out of Admin Mode"
            style={{
              background: 'transparent',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-muted)',
              borderRadius: '4px',
              padding: '4px 8px',
              fontSize: '0.72rem',
              cursor: 'pointer',
            }}
          >
            Sign Out
          </button>
          <button onClick={onCloseCluster} className="btn-close-drawer">✕</button>
        </div>
      </div>

      <div className="drawer-content">
        {/* Metric Badges */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '16px' }}>
          <div className="stat-card">
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Complaints</span>
            <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#38bdf8' }}>
              {selectedCluster.complaint_count}
            </div>
          </div>
          <div className="stat-card">
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Radius</span>
            <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'white' }}>
              ~{Math.round(selectedCluster.radius_meters)}m
            </div>
          </div>
          <div className="stat-card">
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Status</span>
            <div style={{ fontSize: '0.78rem', fontWeight: 600, textTransform: 'capitalize', color: selectedCluster.gov_status === 'resolved' ? '#10b981' : '#f59e0b', marginTop: '4px' }}>
              {selectedCluster.gov_status.replace('_', ' ')}
            </div>
          </div>
        </div>

        {/* Category Breakdown (Deterministic) */}
        <div className="drawer-section">
          <div className="section-title">📊 Category Breakdown (Verified DB Records)</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
            {Object.entries(selectedCluster.category_counts || {}).map(([cat, count]) => (
              <span key={cat} className="category-pill">
                {cat.replace('_', ' ')}: <strong>{count}</strong>
              </span>
            ))}
          </div>
        </div>

        {/* Locality Distribution */}
        {selectedCluster.locality_groups && selectedCluster.locality_groups.length > 0 && (
          <div className="drawer-section">
            <div className="section-title">🏘️ Affected Pockets & Streets</div>
            <div style={{ marginTop: '6px' }}>
              {selectedCluster.locality_groups.map((lg) => (
                <div key={lg.locality} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', padding: '4px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                  <span>{lg.locality}</span>
                  <span style={{ color: 'var(--text-muted)' }}>{lg.count} reports</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* AWS Strands Cluster Intelligence 5-Point Analysis */}
        <div className="drawer-section" style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="section-title" style={{ color: '#38bdf8' }}>
              ⚡ AWS Strands 5-Point Analysis
            </div>
            <button
              onClick={handleRefreshAnalysis}
              className="btn btn-outline btn-sm"
              disabled={refreshingAnalysis}
              style={{ fontSize: '0.7rem', padding: '2px 8px' }}
            >
              {refreshingAnalysis ? 'Analyzing...' : '🔄 Refresh AI'}
            </button>
          </div>

          <div style={{ marginTop: '10px', fontSize: '0.8rem', lineHeight: '1.45' }}>
            <div style={{ marginBottom: '8px' }}>
              <strong style={{ color: '#93c5fd' }}>1. Issue Overview:</strong>
              <div style={{ color: 'var(--text-main)', marginTop: '2px' }}>
                {analysis.issue_overview || analysis.most_common_issues || 'Analysis pending.'}
              </div>
            </div>

            <div style={{ marginBottom: '8px' }}>
              <strong style={{ color: '#93c5fd' }}>2. Geographic Distribution:</strong>
              <div style={{ color: 'var(--text-main)', marginTop: '2px' }}>
                {analysis.geographic_distribution || 'Centered within 700m cluster threshold.'}
              </div>
            </div>

            <div style={{ marginBottom: '8px' }}>
              <strong style={{ color: '#93c5fd' }}>3. Category Patterns:</strong>
              <div style={{ color: 'var(--text-main)', marginTop: '2px' }}>
                {analysis.category_frequency_patterns || 'Multiple grievances logged across supply cycles.'}
              </div>
            </div>

            <div style={{ marginBottom: '8px' }}>
              <strong style={{ color: '#f59e0b' }}>4. Priority Indicators:</strong>
              <div style={{ color: 'var(--text-main)', marginTop: '2px' }}>
                {analysis.priority_indicators || 'Triage required based on complaint volume.'}
              </div>
            </div>

            <div style={{ marginBottom: '8px' }}>
              <strong style={{ color: '#10b981' }}>5. Suggested Next Steps:</strong>
              <div style={{ color: 'var(--text-main)', marginTop: '2px' }}>
                {analysis.inspection_next_steps || analysis.spots_to_check || 'Inspect local valve chambers and grab sample.'}
              </div>
            </div>

            {analysis.root_cause_hypothesis && (
              <div style={{ fontSize: '0.72rem', color: '#94a3b8', fontStyle: 'italic', marginTop: '6px', borderTop: '1px dashed var(--border-subtle)', paddingTop: '6px' }}>
                {analysis.root_cause_hypothesis}
              </div>
            )}

            <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)', marginTop: '8px', display: 'flex', justifyContent: 'space-between' }}>
              <span>Provider: {metadata.configured_provider || 'Strands AI'}</span>
              <span>Version: {metadata.analysis_version || '1.0'}</span>
            </div>
          </div>
        </div>

        {/* Agent B Government Assistant (Advisory) */}
        <div className="drawer-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="section-title">💡 Department Triage Assistant (Agent B)</div>
            <button
              onClick={handleRequestAssistance}
              className="btn btn-outline btn-sm"
              disabled={loadingAssistance}
              style={{ fontSize: '0.7rem', padding: '2px 8px' }}
            >
              {loadingAssistance ? 'Consulting...' : 'Ask Assistant'}
            </button>
          </div>

          {govAssistance && (
            <div style={{ marginTop: '8px', background: 'rgba(30, 41, 59, 0.7)', borderRadius: '6px', padding: '10px' }}>
              <div style={{ fontSize: '0.78rem', color: '#cbd5e1', marginBottom: '8px' }}>
                {govAssistance.summary_of_situation}
              </div>

              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#38bdf8', marginBottom: '4px' }}>
                Recommended Departments:
              </div>
              {govAssistance.recommended_departments.map((dept, idx) => (
                <div key={idx} style={{ marginBottom: '6px', padding: '6px', background: 'rgba(15, 23, 42, 0.5)', borderRadius: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 600, color: 'white' }}>
                    <span>{dept.department}</span>
                    <span style={{ color: dept.urgency === 'Immediate' || dept.urgency === 'High' ? '#ef4444' : '#f59e0b', fontSize: '0.7rem' }}>
                      {dept.urgency}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '2px' }}>
                    {dept.rationale}
                  </div>
                </div>
              ))}

              <div style={{ fontSize: '0.68rem', color: '#64748b', fontStyle: 'italic', marginTop: '6px' }}>
                {govAssistance.advisory_note}
              </div>
            </div>
          )}
        </div>

        {/* Official Action Submission (Human-In-The-Loop) */}
        <div className="drawer-section">
          <div className="section-title">✍️ Record Official Action (HITL)</div>

          {actionSuccessMsg && (
            <div style={{ background: '#064e3b', border: '1px solid #10b981', color: '#6ee7b7', padding: '8px', borderRadius: '6px', fontSize: '0.78rem', marginBottom: '10px' }}>
              {actionSuccessMsg}
            </div>
          )}

          <form onSubmit={handleActionSubmit} style={{ marginTop: '8px' }}>
            <div style={{ marginBottom: '8px' }}>
              <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>
                Status Update
              </label>
              <select
                className="form-input"
                value={govStatus}
                onChange={(e) => setGovStatus(e.target.value)}
              >
                <option value="pending_review">Pending Review</option>
                <option value="team_dispatched">Team Dispatched (Repair Van / Inspection)</option>
                <option value="investigation_active">Investigation Active</option>
                <option value="resolved">Resolved & Closed</option>
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
              <div>
                <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>
                  Assigned Department
                </label>
                <input
                  type="text"
                  className="form-input"
                  value={assignedDept}
                  onChange={(e) => setAssignedDept(e.target.value)}
                  placeholder="e.g. DJB West Maintenance"
                />
              </div>
              <div>
                <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>
                  Assigned Engineer / Team
                </label>
                <input
                  type="text"
                  className="form-input"
                  value={assignedPerson}
                  onChange={(e) => setAssignedPerson(e.target.value)}
                  placeholder="e.g. Er. V. Sharma (JE)"
                />
              </div>
            </div>

            <div style={{ marginBottom: '8px' }}>
              <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>
                Official Solution (Broadcast to Citizens)
              </label>
              <textarea
                className="form-input"
                rows={2}
                value={solutionNotes}
                onChange={(e) => setSolutionNotes(e.target.value)}
                placeholder="e.g. Mobile repair van dispatched to valve chamber 4; emergency tanker stationed."
                required
              />
            </div>

            <div style={{ marginBottom: '8px' }}>
              <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>
                Internal Officer Notes (Optional)
              </label>
              <input
                type="text"
                className="form-input"
                value={officerNotes}
                onChange={(e) => setOfficerNotes(e.target.value)}
                placeholder="e.g. Verified with ground team; tanker ID DL-1W-4412 dispatched."
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-block"
              disabled={submittingAction || !solutionNotes.trim()}
              style={{ marginTop: '4px' }}
            >
              {submittingAction ? 'Recording...' : 'Submit Action & Notify Citizens'}
            </button>
          </form>
        </div>

        {/* Individual Complaints in Cluster */}
        <div className="drawer-section">
          <div className="section-title">
            📋 Individual Complaints ({selectedCluster.complaints.length})
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
            Click any ticket to focus on its map pin
          </div>
          <div style={{ maxHeight: '220px', overflowY: 'auto' }}>
            {selectedCluster.complaints.map((c) => {
              const isFocused = focusedComplaintId === c.id || focusedComplaintId === c.ticket_id;
              return (
                <div
                  key={c.id}
                  onClick={() => onFocusComplaint(c)}
                  style={{
                    padding: '8px 10px',
                    background: isFocused ? 'rgba(56, 189, 248, 0.2)' : 'rgba(15, 23, 42, 0.4)',
                    borderRadius: '6px',
                    marginBottom: '6px',
                    cursor: 'pointer',
                    border: isFocused ? '2px solid #38bdf8' : '1px solid var(--border-subtle)',
                    boxShadow: isFocused ? '0 0 12px rgba(56, 189, 248, 0.35)' : undefined,
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    if (!isFocused) e.currentTarget.style.background = 'rgba(56, 189, 248, 0.1)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isFocused) e.currentTarget.style.background = 'rgba(15, 23, 42, 0.4)';
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <code style={{ color: '#38bdf8', fontWeight: 700 }}>{c.ticket_id}</code>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {isFocused && (
                        <span style={{ fontSize: '0.62rem', color: '#38bdf8', fontWeight: 700 }}>
                          📍 Pin Focused
                        </span>
                      )}
                      <span className="category-pill" style={{ fontSize: '0.65rem' }}>
                        {c.issue_category.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                  <div style={{ fontSize: '0.73rem', color: '#e2e8f0', marginTop: '3px', fontWeight: 500 }}>
                    "{c.description}"
                  </div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    📍 {c.locality_name || `${c.latitude.toFixed(4)}°N, ${c.longitude.toFixed(4)}°E`}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}

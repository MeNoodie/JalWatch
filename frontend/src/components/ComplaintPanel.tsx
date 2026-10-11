import React, { useState, useEffect } from 'react';
import { Complaint, IssueCategory } from '../types';
import { submitComplaint, updateCitizenTicket } from '../services/api';
import { saveUserName } from '../services/userService';

const CATEGORIES: { id: IssueCategory; icon: string; label: string }[] = [
  { id: 'dirty_water',   icon: '🟤', label: 'Dirty Water' },
  { id: 'no_water',      icon: '🚫', label: 'No Water' },
  { id: 'low_pressure',  icon: '📉', label: 'Low Pressure' },
  { id: 'leakage',       icon: '💧', label: 'Pipe Leakage' },
  { id: 'bad_smell',     icon: '👃', label: 'Bad Smell' },
  { id: 'tanker_needed', icon: '🚛', label: 'Need Tanker' },
  { id: 'other',         icon: '⚠️', label: 'Other' },
];

const STATUS_CLASSES: Record<string, string> = {
  submitted: 'status-submitted',
  clustered: 'status-clustered',
  investigating: 'status-investigating',
  action_taken: 'status-action_taken',
  resolved: 'status-resolved',
};

interface ComplaintPanelProps {
  tab: 'report' | 'my-tickets';
  onTabChange: (t: 'report' | 'my-tickets') => void;
  onClose: () => void;
  userId: string;
  userName: string;
  onUserNameChange: (name: string) => void;
  selectedLocation: [number, number];
  localityName: string;
  userComplaints: Complaint[];
  newTicket: Complaint | null;
  onTicketCreated: (ticket: Complaint) => void;
  onClearTicket: () => void;
  onRefreshTickets?: () => void;
}

export function ComplaintPanel({
  tab, onTabChange, onClose,
  userId, userName, onUserNameChange,
  selectedLocation, localityName,
  userComplaints, newTicket,
  onTicketCreated, onClearTicket,
  onRefreshTickets,
}: ComplaintPanelProps) {
  const [category, setCategory] = useState<IssueCategory>('dirty_water');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeStr, setTimeStr] = useState(new Date().toLocaleString('en-IN'));

  // Edit / Resolve State
  const [editingTicketId, setEditingTicketId] = useState<string | null>(null);
  const [editDescription, setEditDescription] = useState<string>('');
  const [updatingTicket, setUpdatingTicket] = useState(false);
  const [ticketActionMsg, setTicketActionMsg] = useState<{ id: string; msg: string } | null>(null);

  // Live clock
  useEffect(() => {
    const t = setInterval(() => setTimeStr(new Date().toLocaleString('en-IN')), 1000);
    return () => clearInterval(t);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (description.trim().length < 5) {
      setError('Please describe the issue in at least 5 characters.');
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      const ticket = await submitComplaint({
        user_id: userId,
        user_name: userName,
        latitude: selectedLocation[0],
        longitude: selectedLocation[1],
        locality_name: localityName,
        issue_category: category,
        description: description.trim(),
        is_demo_data: false,
      });
      setDescription('');
      onTicketCreated(ticket);
    } catch (err: any) {
      setError(err.message || 'Submission failed. Is the backend running?');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartEdit = (c: Complaint) => {
    setEditingTicketId(c.ticket_id);
    setEditDescription(c.description);
  };

  const handleSaveEdit = async (ticketId: string) => {
    if (editDescription.trim().length < 5) {
      alert('Please describe the issue in at least 5 characters.');
      return;
    }
    setUpdatingTicket(true);
    try {
      await updateCitizenTicket(ticketId, { description: editDescription.trim() });
      setEditingTicketId(null);
      setTicketActionMsg({ id: ticketId, msg: 'Problem description updated!' });
      setTimeout(() => setTicketActionMsg(null), 3500);
      onRefreshTickets?.();
    } catch (err: any) {
      alert(`Update failed: ${err.message}`);
    } finally {
      setUpdatingTicket(false);
    }
  };

  const handleMarkSolved = async (ticketId: string) => {
    if (!window.confirm('Mark this issue as solved? Municipal teams will be notified and this ticket will be scheduled for automatic removal from the cluster in 72 hours.')) {
      return;
    }
    setUpdatingTicket(true);
    try {
      await updateCitizenTicket(ticketId, {
        status: 'resolved',
        notification_message: 'Issue confirmed resolved by citizen. Auto-removal from active cluster scheduled in 72 hours.',
      });
      setTicketActionMsg({ id: ticketId, msg: 'Issue marked as solved! Auto-removal in 72 hrs.' });
      setTimeout(() => setTicketActionMsg(null), 4000);
      onRefreshTickets?.();
    } catch (err: any) {
      alert(`Could not mark solved: ${err.message}`);
    } finally {
      setUpdatingTicket(false);
    }
  };

  const handleReopen = async (ticketId: string) => {
    setUpdatingTicket(true);
    try {
      await updateCitizenTicket(ticketId, {
        status: 'clustered',
        notification_message: 'Re-opened by citizen. Municipal team re-notified.',
      });
      setTicketActionMsg({ id: ticketId, msg: 'Ticket re-opened for investigation.' });
      setTimeout(() => setTicketActionMsg(null), 3500);
      onRefreshTickets?.();
    } catch (err: any) {
      alert(`Re-open failed: ${err.message}`);
    } finally {
      setUpdatingTicket(false);
    }
  };

  return (
    <div className="complaint-panel">
      {/* ── Panel Header ── */}
      <div className="panel-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '1.05rem' }}>
              {tab === 'report' ? '💧 Report Water Issue' : '📋 My Tickets'}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              West Delhi · {localityName}
            </div>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose} title="Close panel">✕</button>
        </div>

        {/* Tabs */}
        <div className="panel-tabs">
          <button
            className={`panel-tab ${tab === 'report' ? 'active' : ''}`}
            onClick={() => onTabChange('report')}
          >
            + Report Issue
          </button>
          <button
            className={`panel-tab ${tab === 'my-tickets' ? 'active' : ''}`}
            onClick={() => onTabChange('my-tickets')}
          >
            My Tickets ({userComplaints.length})
          </button>
        </div>
      </div>

      {/* ── Panel Body ── */}
      <div className="panel-body">

        {/* ════ REPORT TAB ════ */}
        {tab === 'report' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

            {/* Success banner */}
            {newTicket && (
              <div className="ticket-success">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                      <span style={{ fontSize: '1.1rem' }}>🎉</span>
                      <strong style={{ color: '#34d399', fontSize: '0.95rem' }}>Ticket Issued!</strong>
                    </div>
                    <div style={{ fontSize: '0.82rem', color: '#cbd5e1' }}>
                      <code style={{ color: '#38bdf8', fontWeight: 700, fontSize: '0.9rem' }}>
                        {newTicket.ticket_id}
                      </code>
                      {' '}has been mapped in West Delhi.
                    </div>
                  </div>
                  <button className="btn btn-ghost btn-sm" onClick={onClearTicket} style={{ fontSize: '0.7rem' }}>✕</button>
                </div>
              </div>
            )}

            {/* Name */}
            <div className="form-group">
              <label className="form-label">Your Name</label>
              <input
                className="form-input"
                type="text"
                value={userName}
                onChange={(e) => onUserNameChange(e.target.value)}
                onBlur={() => saveUserName(userName)}
                placeholder="e.g. Rohan Sharma"
              />
            </div>

            {/* Timestamp */}
            <div className="form-group">
              <label className="form-label">🕒 Timestamp (auto)</label>
              <input className="form-input" type="text" value={timeStr} readOnly />
            </div>

            {/* Location readout */}
            <div className="form-group">
              <label className="form-label">📍 Location (from map pin)</label>
              <div style={{
                padding: '9px 13px',
                background: 'rgba(2,132,199,0.08)',
                border: '1px solid rgba(56,189,248,0.25)',
                borderRadius: '8px',
                fontSize: '0.83rem',
                color: 'var(--primary-light)',
                fontWeight: 500,
              }}>
                {localityName}
                <span style={{ color: 'var(--text-dim)', fontWeight: 400, marginLeft: '8px' }}>
                  ({selectedLocation[0].toFixed(4)}°N, {selectedLocation[1].toFixed(4)}°E)
                </span>
              </div>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '3px' }}>
                Drag the 💧 pin on the map to change location
              </span>
            </div>

            {/* Issue Category */}
            <div className="form-group">
              <label className="form-label">💧 Issue Type</label>
              <div className="category-grid">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    className={`category-pill ${category === cat.id ? 'selected' : ''}`}
                    onClick={() => setCategory(cat.id)}
                  >
                    <span className="cat-icon">{cat.icon}</span>
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Description */}
            <div className="form-group">
              <label className="form-label">✍️ Description</label>
              <textarea
                className="form-textarea"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the issue — color, smell, timing, pressure..."
              />
              <span style={{ fontSize: '0.71rem', color: description.length < 5 ? 'var(--text-dim)' : 'var(--status-resolved)', marginTop: '2px' }}>
                {description.length}/1000 chars {description.length < 5 && '(min 5)'}
              </span>
            </div>

            {/* Error */}
            {error && (
              <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '7px', padding: '9px 12px', fontSize: '0.82rem', color: '#fca5a5' }}>
                ⚠️ {error}
              </div>
            )}

            {/* Submit */}
            <button
              className="btn btn-primary"
              style={{ width: '100%', padding: '12px', fontSize: '0.95rem' }}
              onClick={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? '⏳ Submitting...' : '🚀 Submit & Get Ticket ID'}
            </button>

            <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textAlign: 'center' }}>
              Your complaint is anonymous and linked to West Delhi water authority.
            </div>
          </div>
        )}

        {/* ════ MY TICKETS TAB ════ */}
        {tab === 'my-tickets' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {/* New ticket banner */}
            {newTicket && (
              <div className="ticket-success">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem' }}>
                    🎉 Ticket <code style={{ color: '#38bdf8', fontWeight: 700 }}>{newTicket.ticket_id}</code> created!
                  </span>
                  <button className="btn btn-ghost btn-sm" onClick={onClearTicket}>✕</button>
                </div>
              </div>
            )}

            {userComplaints.length === 0 ? (
              <div style={{
                textAlign: 'center', padding: '40px 16px',
                background: 'rgba(15,23,42,0.5)', borderRadius: '10px',
                border: '1px dashed var(--border-subtle)', color: 'var(--text-muted)',
              }}>
                <div style={{ fontSize: '2rem', marginBottom: '10px' }}>📭</div>
                <div style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '6px' }}>No tickets yet</div>
                <div style={{ fontSize: '0.8rem' }}>
                  Use the <strong style={{ color: 'var(--primary-light)' }}>Report Issue</strong> tab to raise your first grievance.
                </div>
                <button
                  className="btn btn-primary btn-sm"
                  style={{ marginTop: '14px' }}
                  onClick={() => onTabChange('report')}
                >
                  + Report Now
                </button>
              </div>
            ) : (
              userComplaints.map((c) => (
                <div key={c.id} className="ticket-card" style={{
                  borderLeft: c.status === 'resolved' ? '4px solid #10b981' : undefined
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span className="ticket-id">{c.ticket_id}</span>
                    <span className={`status-pill ${STATUS_CLASSES[c.status] || ''}`}>
                      {c.status.replace(/_/g, ' ')}
                    </span>
                  </div>

                  {ticketActionMsg && ticketActionMsg.id === c.ticket_id && (
                    <div style={{ background: '#064e3b', border: '1px solid #10b981', color: '#6ee7b7', padding: '6px 10px', borderRadius: '6px', fontSize: '0.74rem', marginTop: '6px' }}>
                      ✓ {ticketActionMsg.msg}
                    </div>
                  )}

                  {editingTicketId === c.ticket_id ? (
                    <div style={{ background: 'rgba(15,23,42,0.7)', padding: '10px', borderRadius: '6px', border: '1px solid #38bdf8', marginTop: '8px' }}>
                      <label style={{ fontSize: '0.72rem', color: '#38bdf8', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                        ✏️ Update Problem Description:
                      </label>
                      <textarea
                        className="form-input"
                        rows={3}
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        placeholder="Update with latest water condition or details..."
                        style={{ fontSize: '0.82rem' }}
                      />
                      <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                        <button
                          className="btn btn-primary btn-sm"
                          disabled={updatingTicket}
                          onClick={() => handleSaveEdit(c.ticket_id)}
                          style={{ fontSize: '0.75rem' }}
                        >
                          {updatingTicket ? 'Saving...' : '💾 Save Update'}
                        </button>
                        <button
                          className="btn btn-outline btn-sm"
                          disabled={updatingTicket}
                          onClick={() => setEditingTicketId(null)}
                          style={{ fontSize: '0.75rem' }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ fontSize: '0.83rem', marginTop: '4px' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-main)', marginBottom: '2px' }}>
                        {c.issue_category.replace(/_/g, ' ').toUpperCase()}
                        {c.locality_name && <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> · {c.locality_name}</span>}
                      </div>
                      <div style={{ color: 'var(--text-muted)', lineHeight: 1.45 }}>{c.description}</div>
                    </div>
                  )}

                  {c.notification_message && (
                    <div className="gov-notice" style={{ marginTop: '8px' }}>
                      <strong style={{ color: 'var(--primary-light)', fontSize: '0.72rem', display: 'block', marginBottom: '2px' }}>
                        📢 Government / Status Update
                      </strong>
                      {c.notification_message}
                    </div>
                  )}

                  {c.status === 'resolved' && (
                    <div style={{
                      background: 'rgba(16, 185, 129, 0.1)',
                      border: '1px solid #10b981',
                      borderRadius: '6px',
                      padding: '6px 10px',
                      fontSize: '0.72rem',
                      color: '#6ee7b7',
                      marginTop: '6px'
                    }}>
                      ⏳ <strong>Auto-Archiving:</strong> Citizen confirmed issue solved. Scheduled for deletion from cluster after 72 hours.
                    </div>
                  )}

                  {/* Citizen Action Buttons */}
                  <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
                    {editingTicketId !== c.ticket_id && c.status !== 'resolved' && (
                      <>
                        <button
                          className="btn btn-outline btn-sm"
                          style={{ fontSize: '0.72rem', padding: '4px 9px' }}
                          onClick={() => handleStartEdit(c)}
                        >
                          ✏️ Update Problem
                        </button>
                        <button
                          className="btn btn-sm"
                          style={{
                            fontSize: '0.72rem',
                            padding: '4px 10px',
                            background: '#059669',
                            color: 'white',
                            border: 'none',
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                          onClick={() => handleMarkSolved(c.ticket_id)}
                          disabled={updatingTicket}
                          title="Click when your water problem is resolved"
                        >
                          ✅ Issue Solved
                        </button>
                      </>
                    )}
                    {c.status === 'resolved' && (
                      <button
                        className="btn btn-outline btn-sm"
                        style={{ fontSize: '0.7rem', padding: '3px 8px' }}
                        onClick={() => handleReopen(c.ticket_id)}
                        disabled={updatingTicket}
                      >
                        🔄 Problem Recurred (Re-open)
                      </button>
                    )}
                  </div>

                  <div style={{
                    display: 'flex', justifyContent: 'space-between',
                    fontSize: '0.72rem', color: 'var(--text-dim)',
                    borderTop: '1px solid var(--border-subtle)', paddingTop: '7px',
                    marginTop: '8px'
                  }}>
                    <span>📍 {c.latitude.toFixed(4)}, {c.longitude.toFixed(4)}</span>
                    <span>{new Date(c.created_at).toLocaleDateString('en-IN')} {new Date(c.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

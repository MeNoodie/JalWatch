import React, { useState, useEffect } from 'react';
import {
  getOrCreateUserId,
  getSavedUserName,
  saveUserName,
  switchActiveUser,
  createNewRandomUser,
  PRESET_USERS,
  UserProfile,
} from '../services/userService';
import { submitComplaint, fetchUserComplaints } from '../services/api';
import { Complaint, IssueCategory } from '../types';
import { UserComplaintMap } from './UserComplaintMap';

const CATEGORIES: { id: IssueCategory; label: string; icon: string; desc: string }[] = [
  { id: 'dirty_water', label: 'Dirty / Muddy Water', icon: '🟤', desc: 'Discolored, turbid or contaminated supply' },
  { id: 'bad_smell', label: 'Foul Smell / Odor', icon: '👃', desc: 'Sewage or chemical smell in tap water' },
  { id: 'no_water', label: 'Complete No Water', icon: '🚫', desc: 'Zero tap flow during scheduled hours' },
  { id: 'low_pressure', label: 'Low Water Pressure', icon: '📉', desc: 'Trickling supply unable to fill tanks' },
  { id: 'leakage', label: 'Main Line Leakage', icon: '💧', desc: 'Burst pipe or street water loss' },
  { id: 'tanker_needed', label: 'Emergency Tanker', icon: '🚛', desc: 'Urgent drinking water delivery required' },
  { id: 'other', label: 'Other Grievance', icon: '⚠️', desc: 'Billing, meter or infrastructure defect' },
];

export function CitizenPortal() {
  const [userId, setUserId] = useState<string>(getOrCreateUserId());
  const [userName, setUserName] = useState<string>(getSavedUserName() || 'Rohan Sharma');
  const [userComplaints, setUserComplaints] = useState<Complaint[]>([]);
  const [loadingComplaints, setLoadingComplaints] = useState<boolean>(true);

  // Form State
  const [issueCategory, setIssueCategory] = useState<IssueCategory>('dirty_water');
  const [description, setDescription] = useState<string>('');
  const [localityName, setLocalityName] = useState<string>('Rohini Sector 7');
  const [selectedLocation, setSelectedLocation] = useState<[number, number]>([28.7041, 77.1025]);
  const [currentTimeStr, setCurrentTimeStr] = useState<string>(new Date().toLocaleString());
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [newlyCreatedTicket, setNewlyCreatedTicket] = useState<Complaint | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Keep live timestamp updated
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTimeStr(new Date().toLocaleString());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch complaints for current active citizen ID
  useEffect(() => {
    loadUserComplaints();
  }, [userId]);

  const loadUserComplaints = async () => {
    setLoadingComplaints(true);
    try {
      const data = await fetchUserComplaints(userId);
      setUserComplaints(data);
    } catch (err) {
      console.error('Failed to load complaints:', err);
    } finally {
      setLoadingComplaints(false);
    }
  };

  const handleNameBlur = () => {
    saveUserName(userName);
  };

  // Switch between simulated citizen profiles for testing multi-user scenarios
  const handleSwitchUser = (profile: UserProfile) => {
    switchActiveUser(profile.id, profile.name);
    setUserId(profile.id);
    setUserName(profile.name);
    setNewlyCreatedTicket(null);
  };

  const handleCreateNewUser = () => {
    const fresh = createNewRandomUser();
    setUserId(fresh.id);
    setUserName(fresh.name);
    setNewlyCreatedTicket(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() || description.length < 5) {
      setFormError('Please provide at least 5 characters describing the water issue.');
      return;
    }
    setFormError(null);
    setIsSubmitting(true);

    try {
      const created = await submitComplaint({
        user_id: userId,
        user_name: userName,
        latitude: selectedLocation[0],
        longitude: selectedLocation[1],
        locality_name: localityName,
        issue_category: issueCategory,
        description: description.trim(),
        is_demo_data: false,
      });

      setNewlyCreatedTicket(created);
      setDescription('');
      // Reload complaints list
      await loadUserComplaints();
    } catch (err: any) {
      setFormError(err.message || 'Submission failed. Please check backend connection.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '1440px', margin: '0 auto' }}>
      {/* Citizen Identity & Multi-User Switcher Header Banner */}
      <div className="glass-panel" style={{
        padding: '16px 22px',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
        background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.85) 0%, rgba(15, 23, 42, 0.95) 100%)',
        borderLeft: '4px solid var(--primary-light)',
      }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: '46px',
              height: '46px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #0284c7 0%, #06b6d4 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.35rem',
              boxShadow: 'var(--shadow-glow)',
            }}>
              👤
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Citizen Tracking Key:</span>
                <code style={{
                  background: 'rgba(0, 0, 0, 0.4)',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  color: 'var(--primary-light)',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  border: '1px solid var(--border-subtle)',
                }}>
                  {userId}
                </code>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>Display Name:</span>
                <input
                  type="text"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  onBlur={handleNameBlur}
                  placeholder="Enter your name"
                  style={{
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid var(--border-focus)',
                    borderRadius: '4px',
                    color: 'white',
                    padding: '2px 8px',
                    fontSize: '0.85rem',
                    width: '180px',
                    fontWeight: 600,
                  }}
                />
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Active Tickets on File</div>
              <div style={{ fontSize: '1.35rem', fontWeight: 700, color: '#38bdf8' }}>
                {userComplaints.length}
              </div>
            </div>
            <button
              onClick={loadUserComplaints}
              className="btn btn-outline"
              style={{ padding: '6px 12px', fontSize: '0.8rem' }}
            >
              🔄 Refresh
            </button>
          </div>
        </div>

        {/* Multi-Citizen Switcher Bar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          flexWrap: 'wrap',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          paddingTop: '10px',
        }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>
            👥 Switch Citizen Profile (Testing):
          </span>
          {PRESET_USERS.map((u) => {
            const isActive = userId === u.id;
            return (
              <button
                key={u.id}
                type="button"
                onClick={() => handleSwitchUser(u)}
                style={{
                  padding: '3px 10px',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  border: isActive ? '1px solid var(--primary-light)' : '1px solid var(--border-subtle)',
                  background: isActive ? 'rgba(56, 189, 248, 0.25)' : 'rgba(15, 23, 42, 0.6)',
                  color: isActive ? '#ffffff' : 'var(--text-muted)',
                  cursor: 'pointer',
                  fontWeight: isActive ? 600 : 400,
                  transition: 'all 0.15s ease',
                }}
              >
                {u.name} ({u.locality.split(' ')[0]})
              </button>
            );
          })}

          <button
            type="button"
            onClick={handleCreateNewUser}
            style={{
              padding: '3px 10px',
              borderRadius: '6px',
              fontSize: '0.75rem',
              border: '1px dashed var(--border-focus)',
              background: 'transparent',
              color: 'var(--primary-light)',
              cursor: 'pointer',
            }}
          >
            + New Random Citizen
          </button>
        </div>
      </div>

      {/* Ticket Created Notification Banner */}
      {newlyCreatedTicket && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(6, 182, 212, 0.15) 100%)',
          border: '1px solid rgba(16, 185, 129, 0.4)',
          borderRadius: '12px',
          padding: '16px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1.25rem' }}>🎉</span>
              <strong style={{ color: '#34d399', fontSize: '1.05rem' }}>
                Grievance Ticket Successfully Issued!
              </strong>
            </div>
            <p style={{ color: '#cbd5e1', fontSize: '0.85rem', marginTop: '4px' }}>
              Your ticket <code style={{ color: '#38bdf8', fontWeight: 700 }}>{newlyCreatedTicket.ticket_id}</code> has been mapped in the Delhi water intelligence system at <strong>{newlyCreatedTicket.locality_name || 'Delhi Locality'}</strong>.
            </p>
          </div>
          <button
            onClick={() => setNewlyCreatedTicket(null)}
            className="btn btn-outline"
            style={{ padding: '4px 10px', fontSize: '0.75rem' }}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Grid: Form (Left) & User Map (Right) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))',
        gap: '24px',
        alignItems: 'start'
      }}>
        {/* Left Column: Complaint Form */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h2 style={{ fontSize: '1.3rem', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>📝</span> Report a Water Grievance
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '20px' }}>
            Submit your issue with location. Two-way synchronized with the map: searching an address moves the pin, and clicking the map updates the address!
          </p>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Automatic Timestamp Input */}
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                🕒 Grievance Timestamp (Automatic)
              </label>
              <input
                type="text"
                value={currentTimeStr}
                readOnly
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  background: 'rgba(15, 23, 42, 0.6)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '8px',
                  color: 'var(--accent)',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  outline: 'none',
                  cursor: 'not-allowed'
                }}
              />
            </div>

            {/* Issue Category Grid */}
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                💧 Select Water Issue Category
              </label>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
                gap: '8px'
              }}>
                {CATEGORIES.map((cat) => {
                  const isSelected = issueCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setIssueCategory(cat.id)}
                      style={{
                        padding: '10px 8px',
                        borderRadius: '8px',
                        border: isSelected ? '1px solid var(--primary-light)' : '1px solid var(--border-subtle)',
                        background: isSelected ? 'rgba(2, 132, 199, 0.25)' : 'rgba(15, 23, 42, 0.5)',
                        color: isSelected ? '#ffffff' : 'var(--text-muted)',
                        cursor: 'pointer',
                        textAlign: 'center',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ fontSize: '1.25rem', marginBottom: '4px' }}>{cat.icon}</div>
                      <div style={{ fontSize: '0.75rem', fontWeight: 600 }}>{cat.label}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Locality / Address Input (Synchronized with Map) */}
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                📍 Locality / Landmark / Street Name
              </label>
              <input
                type="text"
                value={localityName}
                onChange={(e) => setLocalityName(e.target.value)}
                placeholder="e.g. Rohini Sector 7, Block B, Main Market"
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  background: 'rgba(15, 23, 42, 0.6)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '8px',
                  color: 'white',
                  fontSize: '0.9rem',
                  outline: 'none'
                }}
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '4px', display: 'block' }}>
                Auto-updated when you click or drag the pin on the map.
              </span>
            </div>

            {/* Description Textarea */}
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                ✍️ Grievance Description
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe color, smell, pressure or timing of the issue..."
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  background: 'rgba(15, 23, 42, 0.6)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '8px',
                  color: 'white',
                  fontSize: '0.9rem',
                  outline: 'none',
                  resize: 'vertical'
                }}
              />
            </div>

            {/* Selected Coordinates Readout */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.8rem',
              color: 'var(--text-dim)',
              padding: '8px 12px',
              background: 'rgba(15, 23, 42, 0.4)',
              borderRadius: '6px',
            }}>
              <span>Selected Coordinates:</span>
              <code>
                {selectedLocation[0].toFixed(4)}° N, {selectedLocation[1].toFixed(4)}° E
              </code>
            </div>

            {formError && (
              <div style={{ color: '#f87171', fontSize: '0.85rem', padding: '8px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '6px' }}>
                ⚠️ {formError}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="btn btn-primary"
              style={{ padding: '12px', fontSize: '1rem', marginTop: '4px' }}
            >
              {isSubmitting ? 'Raising Grievance Ticket...' : '🚀 Submit Grievance & Issue Ticket'}
            </button>
          </form>
        </div>

        {/* Right Column: User-Side Interactive High-Definition Map */}
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div style={{ marginBottom: '12px' }}>
            <h2 style={{ fontSize: '1.3rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>🗺️</span> Interactive Delhi Grievance Map
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Type any Delhi colony in the map search bar or drag the 💧 pin. Droplets show tickets for <strong>{userName}</strong>.
            </p>
          </div>

          <div style={{ flex: 1, minHeight: '440px' }}>
            <UserComplaintMap
              selectedLocation={selectedLocation}
              onLocationSelect={setSelectedLocation}
              localityName={localityName}
              onLocalityChange={setLocalityName}
              userComplaints={userComplaints}
            />
          </div>
        </div>
      </div>

      {/* Section: My Raised Grievance Tickets & Government Notification Feed */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <h2 style={{ fontSize: '1.3rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>📋</span> Grievances & Live Government Decisions ({userName})
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Track ticket progress and real-time decisions issued by the government response body for your area.
            </p>
          </div>
          <span className="badge badge-online">
            {userComplaints.length} Tickets on File
          </span>
        </div>

        {loadingComplaints ? (
          <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-dim)' }}>
            Loading grievances...
          </div>
        ) : userComplaints.length === 0 ? (
          <div style={{
            padding: '40px',
            textAlign: 'center',
            color: 'var(--text-dim)',
            background: 'rgba(15, 23, 42, 0.4)',
            borderRadius: '8px',
            border: '1px dashed var(--border-subtle)'
          }}>
            <p style={{ fontSize: '1rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
              No grievances raised yet for {userName}.
            </p>
            <p style={{ fontSize: '0.85rem' }}>
              Select a spot on the map or type an address above to raise your first grievance!
            </p>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
            gap: '16px'
          }}>
            {userComplaints.map((c) => (
              <div
                key={c.id}
                style={{
                  background: 'rgba(15, 23, 42, 0.7)',
                  borderRadius: '10px',
                  border: '1px solid var(--border-subtle)',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px'
                }}
              >
                {/* Header: Ticket ID & Status */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <code style={{
                    color: 'var(--primary-light)',
                    fontWeight: 700,
                    fontSize: '0.95rem'
                  }}>
                    {c.ticket_id}
                  </code>
                  <span style={{
                    padding: '3px 8px',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    background: c.status === 'action_taken' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                    color: c.status === 'action_taken' ? '#34d399' : '#fbbf24',
                    border: c.status === 'action_taken' ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(245, 158, 11, 0.4)'
                  }}>
                    {c.status.replace('_', ' ')}
                  </span>
                </div>

                {/* Details */}
                <div style={{ fontSize: '0.85rem' }}>
                  <div style={{ color: 'var(--text-main)', fontWeight: 600, marginBottom: '2px' }}>
                    {c.issue_category.replace('_', ' ').toUpperCase()} • {c.locality_name || 'Delhi Locality'}
                  </div>
                  <div style={{ color: 'var(--text-muted)', lineHeight: 1.4 }}>
                    {c.description}
                  </div>
                </div>

                {/* Real-time Government Notification Box */}
                {c.notification_message && (
                  <div style={{
                    background: 'rgba(2, 132, 199, 0.12)',
                    borderLeft: '3px solid var(--primary-light)',
                    padding: '8px 12px',
                    borderRadius: '4px',
                    fontSize: '0.8rem',
                    color: '#e0f2fe'
                  }}>
                    <strong style={{ color: 'var(--primary-light)', display: 'block', marginBottom: '2px' }}>
                      📢 Government Body Decision:
                    </strong>
                    {c.notification_message}
                  </div>
                )}

                <div style={{
                  fontSize: '0.75rem',
                  color: 'var(--text-dim)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  borderTop: '1px solid var(--border-subtle)',
                  paddingTop: '8px',
                  marginTop: 'auto'
                }}>
                  <span>📍 {c.latitude.toFixed(4)}, {c.longitude.toFixed(4)}</span>
                  <span>{new Date(c.created_at).toLocaleDateString()} {new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

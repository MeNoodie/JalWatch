import { useState, useEffect } from 'react';
import { checkBackendHealth, fetchClusters } from './services/api';
import { Cluster } from './types';
import { WestDelhiMap } from './components/WestDelhiMap';
import { ComplaintPanel } from './components/ComplaintPanel';
import {
  getOrCreateUserId,
  getSavedUserName,
} from './services/userService';
import { fetchUserComplaints } from './services/api';
import { Complaint } from './types';

export function App() {
  const [userId] = useState<string>(getOrCreateUserId());
  const [userName, setUserName] = useState<string>(getSavedUserName() || 'Anonymous Citizen');

  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [userComplaints, setUserComplaints] = useState<Complaint[]>([]);

  // Panel state
  const [panelOpen, setPanelOpen] = useState<boolean>(false);
  const [panelTab, setPanelTab] = useState<'report' | 'my-tickets'>('report');

  // Location state (shared between map and form)
  const [selectedLocation, setSelectedLocation] = useState<[number, number]>([28.6692, 77.0890]); // West Delhi center
  const [localityName, setLocalityName] = useState<string>('West Delhi');

  // Newly submitted ticket (for success banner)
  const [newTicket, setNewTicket] = useState<Complaint | null>(null);

  // Load on mount
  useEffect(() => {
    checkBackendHealth()
      .then(() => setBackendOnline(true))
      .catch(() => setBackendOnline(false));

    loadClusters();
    loadUserComplaints();
  }, []);

  const loadClusters = async () => {
    try {
      const data = await fetchClusters();
      setClusters(data);
    } catch {
      // silently fail — map still works without clusters
    }
  };

  const loadUserComplaints = async () => {
    try {
      const data = await fetchUserComplaints(userId);
      setUserComplaints(data);
    } catch {
      // silently fail
    }
  };

  const handleTicketCreated = (ticket: Complaint) => {
    setNewTicket(ticket);
    setPanelTab('my-tickets');
    loadUserComplaints();
    loadClusters();
  };

  const openReport = () => {
    setPanelTab('report');
    setPanelOpen(true);
  };

  const openMyTickets = () => {
    setPanelTab('my-tickets');
    setPanelOpen(true);
  };

  return (
    <div className="app-shell">
      {/* ── Fullscreen West Delhi Map ── */}
      <div className="map-fullscreen">
        <WestDelhiMap
          selectedLocation={selectedLocation}
          onLocationSelect={setSelectedLocation}
          localityName={localityName}
          onLocalityChange={setLocalityName}
          userComplaints={userComplaints}
          clusters={clusters}
          onOpenReport={openReport}
        />
      </div>

      {/* ── Slim Top Nav (overlay) ── */}
      <header className="top-nav">
        <div className="nav-brand">
          <div className="nav-logo">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>
            </svg>
          </div>
          <div>
            <div className="nav-title">
              JalWatch <span style={{ color: 'var(--primary-light)', fontWeight: 500 }}>West Delhi</span>
            </div>
            <div className="nav-subtitle">Citizen Water Grievance Map</div>
          </div>
        </div>

        <div className="nav-actions">
          {/* Backend status */}
          <span style={{ fontSize: '0.72rem', display: 'flex', alignItems: 'center', color: 'var(--text-muted)' }}>
            <span className={`status-dot ${backendOnline === null ? 'checking' : backendOnline ? 'online' : 'offline'}`} />
            {backendOnline === null ? 'Connecting...' : backendOnline ? 'API Online' : 'API Offline'}
          </span>

          <button
            onClick={openMyTickets}
            className="btn btn-outline btn-sm"
            style={{ position: 'relative' }}
          >
            📋 My Tickets
            {userComplaints.length > 0 && (
              <span style={{
                position: 'absolute',
                top: '-6px',
                right: '-6px',
                background: 'var(--primary)',
                color: 'white',
                fontSize: '0.65rem',
                fontWeight: 700,
                width: '18px',
                height: '18px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                {userComplaints.length}
              </span>
            )}
          </button>

          <button onClick={openReport} className="btn btn-primary btn-sm">
            + Report Issue
          </button>
        </div>
      </header>

      {/* ── Floating Complaint/Tickets Panel ── */}
      {panelOpen && (
        <ComplaintPanel
          tab={panelTab}
          onTabChange={setPanelTab}
          onClose={() => setPanelOpen(false)}
          userId={userId}
          userName={userName}
          onUserNameChange={setUserName}
          selectedLocation={selectedLocation}
          localityName={localityName}
          userComplaints={userComplaints}
          newTicket={newTicket}
          onTicketCreated={handleTicketCreated}
          onClearTicket={() => setNewTicket(null)}
        />
      )}

      {/* ── FAB: Report Issue ── */}
      {!panelOpen && (
        <div className="fab">
          <button
            className="fab-main"
            onClick={openReport}
            title="Report a water issue"
          >
            💧
          </button>
        </div>
      )}

      {/* ── Map Legend (bottom-left) ── */}
      <div className="map-legend">
        <span><span className="legend-dot" style={{ background: '#38bdf8' }} />Your Pin (draggable)</span>
        <span><span className="legend-dot" style={{ background: '#f59e0b' }} />Your Ticket</span>
        <span><span className="legend-dot" style={{ background: '#ef4444' }} />Cluster Hotspot</span>
        <span style={{ color: 'var(--text-dim)', borderLeft: '1px solid var(--border-subtle)', paddingLeft: '12px' }}>
          {clusters.length} clusters · {userComplaints.length} my tickets
        </span>
      </div>
    </div>
  );
}

export default App;

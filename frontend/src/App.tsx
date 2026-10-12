import { useState, useEffect } from 'react';
import { checkBackendHealth, fetchClusters, fetchAdminClusterDetails } from './services/api';
import { Cluster, AdminClusterDetail, AdminComplaintItem, AdminLoginResult } from './types';
import { WestDelhiMap } from './components/WestDelhiMap';
import { ComplaintPanel } from './components/ComplaintPanel';
import { AdminPortal } from './components/AdminPortal';
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

  // Admin Mode & Auth State
  const [isAdminMode, setIsAdminMode] = useState<boolean>(false);
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState<boolean>(
    Boolean(sessionStorage.getItem('jalwatch_admin_token'))
  );
  const [showAdminLoginModal, setShowAdminLoginModal] = useState<boolean>(false);
  const [selectedAdminCluster, setSelectedAdminCluster] = useState<AdminClusterDetail | null>(null);
  const [focusedComplaint, setFocusedComplaint] = useState<AdminComplaintItem | null>(null);

  // Location state (shared between map and form)
  const [selectedLocation, setSelectedLocation] = useState<[number, number]>([28.6692, 77.0890]); // West Delhi center
  const [localityName, setLocalityName] = useState<string>('West Delhi');

  // Newly submitted ticket (for success banner)
  const [newTicket, setNewTicket] = useState<Complaint | null>(null);


  // Load on mount and auto-poll every 5 seconds so citizen sees government updates in real-time
  useEffect(() => {
    checkBackendHealth()
      .then(() => setBackendOnline(true))
      .catch(() => setBackendOnline(false));

    loadClusters();
    loadUserComplaints();

    const interval = setInterval(() => {
      loadUserComplaints();
      loadClusters();
    }, 5000);
    return () => clearInterval(interval);
  }, [userId]);

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
    loadUserComplaints();
  };

  const handleSelectAdminCluster = async (clusterId: string) => {
    if (!isAdminLoggedIn) {
      setShowAdminLoginModal(true);
      return;
    }
    try {
      const details = await fetchAdminClusterDetails(clusterId);
      setSelectedAdminCluster(details);
    } catch (err: any) {
      alert(`Could not load cluster details: ${err.message}`);
    }
  };

  const handleAdminLoginSuccess = (user: AdminLoginResult) => {
    sessionStorage.setItem('jalwatch_admin_token', user.token);
    setIsAdminLoggedIn(true);
    setShowAdminLoginModal(false);
    setIsAdminMode(true);
  };

  const handleAdminLogout = () => {
    sessionStorage.removeItem('jalwatch_admin_token');
    setIsAdminLoggedIn(false);
    setIsAdminMode(false);
    setSelectedAdminCluster(null);
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
          isAdminMode={isAdminMode}
          onSelectAdminCluster={handleSelectAdminCluster}
          selectedAdminCluster={selectedAdminCluster}
          focusedComplaint={focusedComplaint}
          onCloseFocusedComplaint={() => setFocusedComplaint(null)}
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
            <div className="nav-subtitle">
              {isAdminMode ? '🛡️ Government Operations & AI Intelligence' : 'Citizen Water Grievance Map'}
            </div>
          </div>
        </div>

        <div className="nav-actions">
          {/* Backend status */}
          <span style={{ fontSize: '0.72rem', display: 'flex', alignItems: 'center', color: 'var(--text-muted)' }}>
            <span className={`status-dot ${backendOnline === null ? 'checking' : backendOnline ? 'online' : 'offline'}`} />
            {backendOnline === null ? 'Connecting...' : backendOnline ? 'API Online' : 'API Offline'}
          </span>

          {/* Admin Toggle */}
          <button
            onClick={() => {
              if (!isAdminLoggedIn) {
                setShowAdminLoginModal(true);
              } else {
                setIsAdminMode(!isAdminMode);
              }
            }}
            className={`btn btn-sm ${isAdminMode ? 'btn-primary' : 'btn-outline'}`}
            style={{ fontWeight: 600 }}
          >
            {isAdminMode ? '🛡️ Admin Mode' : '🛡️ Officer Portal'}
          </button>

          {isAdminLoggedIn && (
            <button
              onClick={handleAdminLogout}
              className="btn btn-outline btn-sm"
              style={{ fontSize: '0.7rem', padding: '3px 8px' }}
              title="Sign out officer session"
            >
              Logout
            </button>
          )}

          {!isAdminMode && (
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
          )}

          <button onClick={openReport} className="btn btn-primary btn-sm">
            + Report Issue
          </button>
        </div>
      </header>

      {/* ── Floating Complaint/Tickets Panel (Citizen) ── */}
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
          onRefreshTickets={loadUserComplaints}
        />
      )}

      {/* ── Admin Portal: Login Modal & Cluster Inspector Drawer ── */}
      {(showAdminLoginModal || isAdminMode) && (
        <AdminPortal
          isAdminLoggedIn={isAdminLoggedIn}
          onLoginSuccess={(user) => {
            handleAdminLoginSuccess(user);
            if (clusters.length > 0) {
              handleSelectAdminCluster(clusters[0].id);
            }
          }}
          onLogout={handleAdminLogout}
          selectedCluster={selectedAdminCluster}
          onCloseCluster={() => setSelectedAdminCluster(null)}
          onClusterUpdated={(updated) => {
            setSelectedAdminCluster(updated);
            loadClusters();
            loadUserComplaints();
          }}
          onFocusComplaint={(complaint) => {
            setFocusedComplaint(complaint);
            setSelectedLocation([complaint.latitude, complaint.longitude]);
          }}
          focusedComplaintId={focusedComplaint?.id || focusedComplaint?.ticket_id}
          clusters={clusters}
          onSelectCluster={handleSelectAdminCluster}
        />
      )}

      {/* ── FAB: Report Issue ── */}
      {!panelOpen && !isAdminMode && (
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
        {isAdminMode ? (
          <>
            <span><span className="legend-dot" style={{ background: '#ef4444' }} />Hotspot Cluster</span>
            <span><span className="legend-dot" style={{ background: '#38bdf8' }} />Cluster Complaint Pin</span>
            <span style={{ color: '#38bdf8', fontWeight: 600 }}>
              🛡️ Click any hotspot to inspect AI analysis & take action
            </span>
            <span style={{ color: 'var(--text-dim)', borderLeft: '1px solid var(--border-subtle)', paddingLeft: '12px' }}>
              {clusters.length} active hotspots
            </span>
          </>
        ) : (
          <>
            <span><span className="legend-dot" style={{ background: '#38bdf8' }} />Your Selected Location (draggable)</span>
            <span><span className="legend-dot" style={{ background: '#10b981' }} />Your Reported Ticket</span>
            <span style={{ color: 'var(--text-dim)', borderLeft: '1px solid var(--border-subtle)', paddingLeft: '12px' }}>
              {userComplaints.length} my tickets
            </span>
          </>
        )}
      </div>
    </div>
  );
}

export default App;


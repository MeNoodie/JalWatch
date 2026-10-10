import { useState, useEffect } from 'react';
import { checkBackendHealth, HealthResponse } from './services/api';
import { CitizenPortal } from './components/CitizenPortal';

export function App() {
  const [activeTab, setActiveTab] = useState<'citizen' | 'dashboard' | 'track'>('citizen');
  const [backendHealth, setBackendHealth] = useState<HealthResponse | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState<boolean>(true);

  useEffect(() => {
    checkHealth();
  }, []);

  const checkHealth = async () => {
    setIsChecking(true);
    setHealthError(null);
    try {
      const data = await checkBackendHealth();
      setBackendHealth(data);
    } catch (err: any) {
      setHealthError(err.message || 'Failed to connect to backend');
      setBackendHealth(null);
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* Top Banner: Demo Data Notification */}
      <div style={{
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        borderBottom: '1px solid rgba(245, 158, 11, 0.25)',
        padding: '8px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontSize: '0.85rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="badge badge-demo">Demo Mode</span>
          <span style={{ color: '#fcd34d' }}>
            Prototype simulation active — synthetic data for demonstration only.
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isChecking ? (
            <span style={{ color: 'var(--text-muted)' }}>Checking backend...</span>
          ) : backendHealth ? (
            <span className="badge badge-online">● Backend Online ({backendHealth.environment})</span>
          ) : (
            <span style={{ color: '#f87171', display: 'flex', alignItems: 'center', gap: '6px' }} title={healthError || 'Disconnected'}>
              ● API Disconnected {healthError ? `(${healthError})` : ''}
              <button 
                onClick={checkHealth} 
                className="btn btn-outline" 
                style={{ padding: '2px 8px', fontSize: '0.75rem' }}
              >
                Retry
              </button>
            </span>
          )}
        </div>
      </div>

      {/* Main Navigation Bar */}
      <header style={{
        padding: '16px 28px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid var(--border-subtle)',
        background: 'rgba(15, 23, 42, 0.85)',
        backdropFilter: 'blur(8px)',
        position: 'sticky',
        top: 0,
        zIndex: 1000
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #0284c7 0%, #06b6d4 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'var(--shadow-glow)'
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>
            </svg>
          </div>
          <div>
            <h1 className="brand-title" style={{ fontSize: '1.25rem', fontWeight: 700, color: 'white' }}>
              JalWatch <span style={{ color: 'var(--primary-light)', fontWeight: 500 }}>Delhi</span>
            </h1>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
              Citizen-Powered Water Intelligence & Grievance Map
            </p>
          </div>
        </div>

        <nav style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`btn ${activeTab === 'dashboard' ? 'btn-primary' : 'btn-outline'}`}
          >
            🗺️ Operations Dashboard
          </button>
          <button
            onClick={() => setActiveTab('citizen')}
            className={`btn ${activeTab === 'citizen' ? 'btn-primary' : 'btn-outline'}`}
          >
            📝 Report Issue
          </button>
          <button
            onClick={() => setActiveTab('track')}
            className={`btn ${activeTab === 'track' ? 'btn-primary' : 'btn-outline'}`}
          >
            🔍 Track Grievance
          </button>
        </nav>
      </header>

      {/* Main Content Area */}
      <main style={{ flex: 1, padding: '24px 28px', maxWidth: '1440px', margin: '0 auto', width: '100%' }}>
        {activeTab === 'citizen' || activeTab === 'track' ? (
          <CitizenPortal />
        ) : (
          <div className="glass-panel" style={{ padding: '32px', textAlign: 'center', maxWidth: '800px', margin: '40px auto' }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '64px',
              height: '64px',
              borderRadius: '16px',
              backgroundColor: 'rgba(2, 132, 199, 0.15)',
              marginBottom: '16px'
            }}>
              <span style={{ fontSize: '2rem' }}>🗺️</span>
            </div>
            <h2 style={{ fontSize: '1.75rem', marginBottom: '12px' }}>
              Government Operations Dashboard
            </h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '24px', lineHeight: 1.6 }}>
              The government operations interface will visualize cross-agency complaint clusters, review the AI agent's 5-point cluster analysis, and provide Human-In-The-Loop (HITL) action controls to notify citizens.
            </p>

            <button
              onClick={() => setActiveTab('citizen')}
              className="btn btn-primary"
            >
              Go to Citizen Grievance Portal
            </button>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer style={{
        padding: '16px 28px',
        borderTop: '1px solid var(--border-subtle)',
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: '0.8rem',
        color: 'var(--text-dim)'
      }}>
        <span>JalWatch Delhi Prototype — Hackathon Track 02</span>
        <span>© OpenStreetMap contributors for geospatial tiles</span>
      </footer>
    </div>
  );
}

export default App;

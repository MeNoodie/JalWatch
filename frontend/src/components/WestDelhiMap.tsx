import { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Complaint, Cluster } from '../types';
import { searchDelhiAddress, reverseGeocodeDelhi, GeocodeResult } from '../services/geocoding';

// ─── Fix Leaflet icon URLs in Vite ───
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// ─── West Delhi: center + bounds ───
const WEST_DELHI_CENTER: [number, number] = [28.6692, 77.0890];
const WEST_DELHI_ZOOM = 13;

// West Delhi zone quick-chips
const WEST_DELHI_ZONES = [
  { name: 'Rohini Sec 7',    lat: 28.7495, lng: 77.0703 },
  { name: 'Pitampura',       lat: 28.7020, lng: 77.1310 },
  { name: 'Janakpuri',       lat: 28.6289, lng: 77.0789 },
  { name: 'Punjabi Bagh',    lat: 28.6707, lng: 77.1186 },
  { name: 'Tilak Nagar',     lat: 28.6446, lng: 77.0935 },
  { name: 'Paschim Vihar',   lat: 28.6720, lng: 77.0895 },
  { name: 'Vikaspuri',       lat: 28.6350, lng: 77.0620 },
  { name: 'Uttam Nagar',     lat: 28.6182, lng: 77.0590 },
  { name: 'Dwarka Sec 6',    lat: 28.5840, lng: 77.0620 },
  { name: 'Subhash Nagar',   lat: 28.6440, lng: 77.1120 },
];

// ─── Custom Icons ───
const newPinIcon = L.divIcon({
  className: 'custom-pin-new',
  html: `<div style="
    background: linear-gradient(135deg, #0284c7 0%, #06b6d4 100%);
    width: 36px; height: 36px;
    border-radius: 50% 50% 50% 0;
    transform: rotate(-45deg);
    border: 3px solid #ffffff;
    box-shadow: 0 4px 20px rgba(2,132,199,0.9), 0 0 0 6px rgba(2,132,199,0.2);
    display: flex; align-items: center; justify-content: center;
  "><span style="transform:rotate(45deg);font-size:15px;line-height:1;">💧</span></div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 36],
  popupAnchor: [0, -38],
});

function makeTicketIcon(status: string) {
  const colors: Record<string, string> = {
    action_taken: '#10b981',
    resolved: '#6ee7b7',
    investigating: '#a78bfa',
    clustered: '#38bdf8',
    submitted: '#f59e0b',
  };
  const color = colors[status] || '#f59e0b';
  return L.divIcon({
    className: 'custom-pin-user',
    html: `<div style="
      background: ${color};
      width: 24px; height: 24px;
      border-radius: 50%;
      border: 2.5px solid rgba(255,255,255,0.9);
      box-shadow: 0 0 14px ${color}99;
      display: flex; align-items: center; justify-content: center;
      font-size: 11px; color: white; font-weight: bold;
    ">📍</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -14],
  });
}

function makeClusterIcon(count: number, status: string) {
  const urgent = count >= 10;
  const bg = urgent ? 'linear-gradient(135deg,#dc2626,#ef4444)' : 'linear-gradient(135deg,#d97706,#f59e0b)';
  const glow = urgent ? '#dc262699' : '#d9770699';
  return L.divIcon({
    className: 'custom-pin-cluster',
    html: `<div style="
      background: ${bg};
      width: 46px; height: 46px;
      border-radius: 50%;
      border: 3px solid rgba(255,255,255,0.35);
      box-shadow: 0 4px 20px ${glow}, 0 0 0 8px ${glow.replace('99','22')};
      display: flex; align-items: center; justify-content: center;
      flex-direction: column;
      color: white; font-weight: 700;
      font-size: 0.88rem; line-height: 1.1;
      cursor: pointer;
      transition: transform 0.2s;
    " onmouseover="this.style.transform='scale(1.12)'" onmouseout="this.style.transform='scale(1)'">
      <span>${count}</span>
      <span style="font-size:0.45rem;opacity:0.9;letter-spacing:0.03em;">REPORTS</span>
    </div>`,
    iconSize: [46, 46],
    iconAnchor: [23, 23],
    popupAnchor: [0, -26],
  });
}

// ─── Map sub-components ───

function LocationPicker({
  position,
  onPositionChange,
  localityLabel,
}: {
  position: [number, number];
  onPositionChange: (pos: [number, number]) => void;
  localityLabel?: string;
}) {
  useMapEvents({
    click(e) {
      onPositionChange([e.latlng.lat, e.latlng.lng]);
    },
  });

  return (
    <Marker
      position={position}
      icon={newPinIcon}
      draggable={true}
      eventHandlers={{
        dragend: (e) => {
          const { lat, lng } = e.target.getLatLng();
          onPositionChange([lat, lng]);
        },
      }}
    >
      <Popup>
        <div style={{ color: '#0f172a', fontWeight: 600, minWidth: '160px' }}>
          <div style={{ color: '#0284c7', marginBottom: '3px' }}>📍 Selected Location</div>
          <div style={{ fontWeight: 500, fontSize: '0.88rem' }}>{localityLabel || 'West Delhi'}</div>
          <div style={{ fontSize: '0.73rem', color: '#64748b', marginTop: '3px' }}>
            {position[0].toFixed(5)}° N, {position[1].toFixed(5)}° E
          </div>
          <div style={{ fontSize: '0.7rem', color: '#0369a1', marginTop: '5px' }}>
            Drag pin or click map to reposition
          </div>
        </div>
      </Popup>
    </Marker>
  );
}

function MapFlyTo({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, WEST_DELHI_ZOOM, { duration: 0.9 });
    const t = setTimeout(() => map.invalidateSize(), 200);
    return () => clearTimeout(t);
  }, [center, map]);
  return null;
}

// ─── Main Component ───

interface WestDelhiMapProps {
  selectedLocation: [number, number];
  onLocationSelect: (pos: [number, number]) => void;
  localityName: string;
  onLocalityChange: (name: string) => void;
  userComplaints: Complaint[];
  clusters: Cluster[];
  onOpenReport: () => void;
}

export function WestDelhiMap({
  selectedLocation,
  onLocationSelect,
  localityName,
  onLocalityChange,
  userComplaints,
  clusters,
  onOpenReport,
}: WestDelhiMapProps) {
  const [mapCenter, setMapCenter] = useState<[number, number]>(WEST_DELHI_CENTER);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GeocodeResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [activeChip, setActiveChip] = useState<string | null>(null);
  const searchRef = useRef<any>(null);

  const handlePositionUpdate = async (coords: [number, number]) => {
    onLocationSelect(coords);
    setMapCenter(coords);
    try {
      const address = await reverseGeocodeDelhi(coords[0], coords[1]);
      if (address) onLocalityChange(address);
    } catch { /* ignore */ }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);
    if (searchRef.current) clearTimeout(searchRef.current);
    if (val.trim().length < 2) { setSearchResults([]); return; }
    searchRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await searchDelhiAddress(val);
        setSearchResults(results);
      } catch { setSearchResults([]); }
      setIsSearching(false);
    }, 350);
  };

  const handleSelectResult = (r: GeocodeResult) => {
    onLocationSelect([r.lat, r.lng]);
    setMapCenter([r.lat, r.lng]);
    onLocalityChange(r.label);
    setSearchResults([]);
    setSearchQuery(r.label);
    setActiveChip(null);
  };

  const handleChip = (zone: typeof WEST_DELHI_ZONES[0]) => {
    setActiveChip(zone.name);
    setSearchQuery('');
    setSearchResults([]);
    onLocationSelect([zone.lat, zone.lng]);
    setMapCenter([zone.lat, zone.lng]);
    onLocalityChange(zone.name);
  };

  const handleGPS = () => {
    if (!navigator.geolocation) { alert('GPS not supported'); return; }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const coords: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        handlePositionUpdate(coords);
      },
      (err) => alert(`Location error: ${err.message}`),
      { timeout: 10000 }
    );
  };

  return (
    <>
      {/* ── Floating Search Bar (top-left) ── */}
      <div className="map-search-bar">
        <div style={{ position: 'relative' }}>
          <div className="search-input-wrap">
            <div style={{ position: 'relative', flex: 1 }}>
              <input
                className="search-input"
                type="text"
                value={searchQuery}
                onChange={handleSearchChange}
                placeholder="Search West Delhi area..."
              />
              <span className="search-icon">🔍</span>
            </div>
            <button
              className="btn btn-outline btn-sm btn-icon"
              onClick={handleGPS}
              title="Use my GPS location"
              style={{ flexShrink: 0 }}
            >
              📍
            </button>
          </div>

          {/* Search spinner */}
          {isSearching && (
            <span style={{
              position: 'absolute', right: '50px', top: '10px',
              fontSize: '0.7rem', color: 'var(--text-dim)'
            }}>searching...</span>
          )}

          {/* Dropdown results */}
          {searchResults.length > 0 && (
            <div className="search-results-dropdown" style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '4px' }}>
              {searchResults.map((r, i) => (
                <div key={i} className="search-result-item" onClick={() => handleSelectResult(r)}>
                  <span style={{ color: 'var(--primary-light)' }}>📌</span>
                  <span>{r.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* West Delhi zone chips */}
        <div className="quick-chips">
          {WEST_DELHI_ZONES.map((z) => (
            <button
              key={z.name}
              className={`chip ${activeChip === z.name ? 'active' : ''}`}
              onClick={() => handleChip(z)}
            >
              {z.name}
            </button>
          ))}
        </div>
      </div>

      {/* ── Leaflet Map ── */}
      <MapContainer
        center={WEST_DELHI_CENTER}
        zoom={WEST_DELHI_ZOOM}
        style={{ width: '100%', height: '100%' }}
        zoomControl={false}
      >
        {/* OSM tiles — free, no API key needed */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />

        <MapFlyTo center={mapCenter} />

        {/* Draggable location picker pin */}
        <LocationPicker
          position={selectedLocation}
          onPositionChange={handlePositionUpdate}
          localityLabel={localityName}
        />

        {/* User's own complaint markers */}
        {userComplaints.map((c) => (
          <Marker
            key={c.id}
            position={[c.latitude, c.longitude]}
            icon={makeTicketIcon(c.status)}
          >
            <Popup>
              <div style={{ color: '#0f172a', minWidth: '200px', fontSize: '0.83rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', borderBottom: '1px solid #e2e8f0', paddingBottom: '5px' }}>
                  <strong style={{ color: '#0284c7', fontFamily: 'monospace' }}>{c.ticket_id}</strong>
                  <span style={{
                    fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px', fontWeight: 700,
                    background: c.status === 'action_taken' ? '#dcfce7' : '#fef3c7',
                    color: c.status === 'action_taken' ? '#166534' : '#92400e',
                  }}>
                    {c.status.replace(/_/g, ' ').toUpperCase()}
                  </span>
                </div>
                <div style={{ fontWeight: 600, marginBottom: '3px' }}>
                  {c.issue_category.replace(/_/g, ' ').toUpperCase()}
                </div>
                <div style={{ color: '#475569', fontSize: '0.78rem', marginBottom: '6px' }}>{c.description}</div>
                {c.notification_message && (
                  <div style={{ background: '#f0f9ff', borderLeft: '3px solid #0284c7', padding: '5px 7px', borderRadius: '0 4px 4px 0', fontSize: '0.73rem', color: '#0369a1' }}>
                    📢 <strong>Gov Update:</strong> {c.notification_message}
                  </div>
                )}
                <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: '5px' }}>
                  📍 {c.locality_name || 'West Delhi'} · {new Date(c.created_at).toLocaleDateString()}
                </div>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Cluster hotspot markers + radius circles */}
        {clusters.map((cl) => (
          <Marker
            key={cl.id}
            position={[cl.center_lat, cl.center_lng]}
            icon={makeClusterIcon(cl.complaint_count, cl.gov_status)}
          >
            <Popup>
              <div style={{ color: '#0f172a', minWidth: '230px', fontSize: '0.83rem' }}>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '6px', color: '#dc2626' }}>
                  🔴 {cl.name || 'Complaint Hotspot'}
                </div>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                  <span style={{ background: '#fef3c7', color: '#92400e', padding: '2px 7px', borderRadius: '4px', fontSize: '0.73rem', fontWeight: 700 }}>
                    {cl.complaint_count} Reports
                  </span>
                  <span style={{ background: '#e0f2fe', color: '#0369a1', padding: '2px 7px', borderRadius: '4px', fontSize: '0.73rem' }}>
                    {cl.gov_status?.replace(/_/g, ' ')}
                  </span>
                </div>
                {cl.dominant_issue && (
                  <div style={{ marginBottom: '6px' }}>
                    <strong>Main Issue:</strong> {cl.dominant_issue.replace(/_/g, ' ')}
                  </div>
                )}
                {cl.agent_summary && (
                  <div style={{ background: '#f8fafc', borderRadius: '6px', padding: '7px', border: '1px solid #e2e8f0', fontSize: '0.75rem' }}>
                    <div style={{ fontWeight: 700, color: '#0284c7', marginBottom: '5px' }}>🤖 AI Analysis</div>
                    {cl.agent_summary.quick_action && (
                      <div style={{ marginBottom: '4px' }}><strong>⚡ Action:</strong> {cl.agent_summary.quick_action}</div>
                    )}
                    {cl.agent_summary.most_common_issues && (
                      <div><strong>📊 Issues:</strong> {cl.agent_summary.most_common_issues}</div>
                    )}
                  </div>
                )}
                {cl.gov_solution && (
                  <div style={{ background: '#f0fdf4', borderLeft: '3px solid #10b981', padding: '5px 7px', marginTop: '6px', fontSize: '0.75rem', color: '#166534' }}>
                    ✅ <strong>Gov Action:</strong> {cl.gov_solution}
                  </div>
                )}
                <button
                  onClick={onOpenReport}
                  style={{
                    marginTop: '8px', width: '100%', padding: '6px',
                    background: 'linear-gradient(135deg,#0284c7,#06b6d4)',
                    color: 'white', border: 'none', borderRadius: '6px',
                    fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  + Add My Report Here
                </button>
              </div>
            </Popup>
            {/* Transparent radius indicator */}
            <Circle
              center={[cl.center_lat, cl.center_lng]}
              radius={cl.radius_meters || 700}
              pathOptions={{
                color: cl.complaint_count >= 10 ? '#ef4444' : '#f59e0b',
                fillColor: cl.complaint_count >= 10 ? '#ef4444' : '#f59e0b',
                fillOpacity: 0.06,
                weight: 1.5,
                dashArray: '5,5',
              }}
            />
          </Marker>
        ))}
      </MapContainer>
    </>
  );
}

import { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Complaint } from '../types';
import { searchDelhiAddress, reverseGeocodeDelhi, GeocodeResult } from '../services/geocoding';

// Fix Leaflet default icon URLs in Vite
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Custom Modern Pin for Selected Complaint Spot
const newPinIcon = L.divIcon({
  className: 'custom-pin-new',
  html: `<div style="
    background: linear-gradient(135deg, #0284c7 0%, #06b6d4 100%);
    width: 32px;
    height: 32px;
    border-radius: 50% 50% 50% 0;
    transform: rotate(-45deg);
    border: 3px solid #ffffff;
    box-shadow: 0 4px 16px rgba(2, 132, 199, 0.9);
    display: flex;
    align-items: center;
    justify-content: center;
    animation: bounce 1.5s infinite alternate ease-in-out;
  "><span style="transform: rotate(45deg); font-size: 14px;">💧</span></div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32],
});

// Custom Icon for Previously Raised Complaints
function createMyComplaintIcon(status: string) {
  let color = '#f59e0b'; // amber (submitted)
  if (status === 'action_taken' || status === 'resolved') color = '#10b981'; // green (action taken)
  if (status === 'investigating' || status === 'clustered') color = '#38bdf8'; // blue (clustered)

  return L.divIcon({
    className: 'custom-pin-user',
    html: `<div style="
      background: ${color};
      width: 26px;
      height: 26px;
      border-radius: 50%;
      border: 2px solid #ffffff;
      box-shadow: 0 0 12px ${color};
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      color: white;
      font-weight: bold;
    ">📍</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    popupAnchor: [0, -13],
  });
}

interface LocationMarkerProps {
  position: [number, number];
  onPositionChange: (pos: [number, number]) => void;
  localityLabel?: string;
}

function LocationPicker({ position, onPositionChange, localityLabel }: LocationMarkerProps) {
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
          const marker = e.target;
          const latLng = marker.getLatLng();
          onPositionChange([latLng.lat, latLng.lng]);
        },
      }}
    >
      <Popup>
        <div style={{ color: '#0f172a', fontWeight: 600 }}>
          📍 Selected Complaint Spot
          <div style={{ fontSize: '0.85rem', color: '#0284c7', marginTop: '2px' }}>
            {localityLabel || 'Delhi Location'}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
            {position[0].toFixed(4)}° N, {position[1].toFixed(4)}° E
          </div>
          <div style={{ fontSize: '0.7rem', color: '#0369a1', marginTop: '4px' }}>
            (Drag pin or click anywhere on map to reposition)
          </div>
        </div>
      </Popup>
    </Marker>
  );
}

function MapController({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, 14, { duration: 1.0 });
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 200);
    return () => clearTimeout(timer);
  }, [center, map]);
  return null;
}

interface UserComplaintMapProps {
  selectedLocation: [number, number];
  onLocationSelect: (pos: [number, number]) => void;
  localityName: string;
  onLocalityChange: (name: string) => void;
  userComplaints: Complaint[];
}

export function UserComplaintMap({
  selectedLocation,
  onLocationSelect,
  localityName,
  onLocalityChange,
  userComplaints,
}: UserComplaintMapProps) {
  const [mapCenter, setMapCenter] = useState<[number, number]>(selectedLocation);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<GeocodeResult[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [tileStyle, setTileStyle] = useState<'voyager' | 'osm'>('voyager');
  const searchTimeoutRef = useRef<any>(null);

  // Synchronize pin movement with reverse geocoding
  const handlePositionUpdate = async (coords: [number, number]) => {
    onLocationSelect(coords);
    setMapCenter(coords);
    // Reverse geocode to auto-fill locality name
    const address = await reverseGeocodeDelhi(coords[0], coords[1]);
    if (address) {
      onLocalityChange(address);
    }
  };

  // Live address search debounce
  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (val.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearching(true);
      const results = await searchDelhiAddress(val);
      setSearchResults(results);
      setIsSearching(false);
    }, 350);
  };

  const handleSelectSearchResult = (result: GeocodeResult) => {
    onLocationSelect([result.lat, result.lng]);
    setMapCenter([result.lat, result.lng]);
    onLocalityChange(result.label);
    setSearchResults([]);
    setSearchQuery(result.label);
  };

  const handleUseGPS = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const coords: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        onLocationSelect(coords);
        setMapCenter(coords);
        const address = await reverseGeocodeDelhi(coords[0], coords[1]);
        if (address) onLocalityChange(address);
      },
      (err) => {
        alert(`Location permission denied or unavailable: ${err.message}`);
      },
      { timeout: 10000 }
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', height: '100%' }}>
      {/* Live Address Search & Quick Controls Bar */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        padding: '12px 14px',
        background: 'rgba(15, 23, 42, 0.85)',
        borderRadius: '10px',
        border: '1px solid var(--border-subtle)',
        position: 'relative',
        zIndex: 1001,
      }}>
        {/* Address Search Input */}
        <div style={{ position: 'relative', width: '100%' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <input
                type="text"
                value={searchQuery}
                onChange={handleSearchInputChange}
                placeholder="🔍 Search Delhi colony, sector, or street (e.g. Rohini Sec 7, Hauz Khas)..."
                style={{
                  width: '100%',
                  padding: '10px 14px 10px 36px',
                  background: 'rgba(30, 41, 59, 0.9)',
                  border: '1px solid var(--border-focus)',
                  borderRadius: '8px',
                  color: 'white',
                  fontSize: '0.875rem',
                  outline: 'none',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                }}
              />
              <span style={{ position: 'absolute', left: '12px', top: '10px', fontSize: '0.9rem', opacity: 0.7 }}>
                📍
              </span>
            </div>

            <button
              type="button"
              onClick={handleUseGPS}
              className="btn btn-primary"
              style={{ padding: '8px 14px', fontSize: '0.8rem', whiteSpace: 'nowrap' }}
              title="Use current GPS location"
            >
              📍 My GPS
            </button>
          </div>

          {/* Autocomplete Dropdown List */}
          {searchResults.length > 0 && (
            <div style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              marginTop: '4px',
              background: '#0f172a',
              border: '1px solid var(--border-focus)',
              borderRadius: '8px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
              maxHeight: '220px',
              overflowY: 'auto',
              zIndex: 2000,
            }}>
              {searchResults.map((res, idx) => (
                <div
                  key={idx}
                  onClick={() => handleSelectSearchResult(res)}
                  style={{
                    padding: '10px 14px',
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    color: '#e2e8f0',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    transition: 'background 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(56, 189, 248, 0.15)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <span style={{ color: 'var(--primary-light)' }}>📌</span>
                  <span>{res.label}</span>
                </div>
              ))}
            </div>
          )}

          {isSearching && (
            <div style={{ position: 'absolute', right: '110px', top: '12px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Searching...
            </div>
          )}
        </div>

        {/* Quick Delhi Locality Chips & Tile Switcher */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Popular:</span>
            {[
              { name: 'Rohini Sec 7', lat: 28.7041, lng: 77.1025 },
              { name: 'Okhla Ph 3', lat: 28.5355, lng: 77.2612 },
              { name: 'Mayur Vihar 1', lat: 28.6085, lng: 77.2954 },
              { name: 'Karol Bagh', lat: 28.6514, lng: 77.1907 },
              { name: 'Sangam Vihar', lat: 28.5020, lng: 77.2410 },
              { name: 'Dwarka Sec 10', lat: 28.5921, lng: 77.0460 },
            ].map((loc) => (
              <button
                key={loc.name}
                type="button"
                onClick={() => handlePositionUpdate([loc.lat, loc.lng])}
                className="btn btn-outline"
                style={{
                  padding: '3px 8px',
                  fontSize: '0.75rem',
                  background: selectedLocation[0] === loc.lat ? 'rgba(56, 189, 248, 0.25)' : 'transparent',
                  borderColor: selectedLocation[0] === loc.lat ? 'var(--primary-light)' : 'var(--border-subtle)',
                }}
              >
                {loc.name}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              type="button"
              onClick={() => setTileStyle('voyager')}
              style={{
                padding: '2px 8px',
                fontSize: '0.7rem',
                borderRadius: '4px',
                border: '1px solid var(--border-subtle)',
                background: tileStyle === 'voyager' ? 'var(--primary)' : 'transparent',
                color: 'white',
                cursor: 'pointer',
              }}
              title="Detailed High-Definition Street Map"
            >
              🗺️ HD Streets
            </button>
            <button
              type="button"
              onClick={() => setTileStyle('osm')}
              style={{
                padding: '2px 8px',
                fontSize: '0.7rem',
                borderRadius: '4px',
                border: '1px solid var(--border-subtle)',
                background: tileStyle === 'osm' ? 'var(--primary)' : 'transparent',
                color: 'white',
                cursor: 'pointer',
              }}
              title="Standard OSM Tiles"
            >
              OSM
            </button>
          </div>
        </div>
      </div>

      {/* Embedded High-Definition Map */}
      <div style={{
        flex: 1,
        minHeight: '380px',
        borderRadius: '12px',
        overflow: 'hidden',
        border: '1px solid var(--border-subtle)',
        position: 'relative',
        boxShadow: 'var(--shadow-glow)',
      }}>
        <MapContainer
          center={selectedLocation}
          zoom={13}
          style={{ width: '100%', height: '100%', minHeight: '380px' }}
        >
          {tileStyle === 'voyager' ? (
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
              url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
              maxZoom={19}
            />
          ) : (
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              maxZoom={19}
            />
          )}

          <MapController center={mapCenter} />

          {/* New Selected Pin (Two-way synchronized) */}
          <LocationPicker
            position={selectedLocation}
            onPositionChange={handlePositionUpdate}
            localityLabel={localityName}
          />

          {/* Render User's Previously Raised Complaints */}
          {userComplaints.map((c) => (
            <Marker
              key={c.id}
              position={[c.latitude, c.longitude]}
              icon={createMyComplaintIcon(c.status)}
            >
              <Popup>
                <div style={{ color: '#0f172a', minWidth: '220px', fontSize: '0.85rem' }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderBottom: '1px solid #e2e8f0',
                    paddingBottom: '4px',
                    marginBottom: '6px'
                  }}>
                    <strong style={{ color: '#0284c7' }}>{c.ticket_id}</strong>
                    <span style={{
                      fontSize: '0.7rem',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      background: c.status === 'action_taken' ? '#dcfce7' : '#fef3c7',
                      color: c.status === 'action_taken' ? '#166534' : '#92400e',
                      fontWeight: 600,
                    }}>
                      {c.status.replace('_', ' ').toUpperCase()}
                    </span>
                  </div>

                  <div style={{ fontWeight: 600, marginBottom: '2px' }}>
                    Issue: {c.issue_category.replace('_', ' ').toUpperCase()}
                  </div>
                  <div style={{ color: '#475569', fontSize: '0.8rem', marginBottom: '8px' }}>
                    {c.description}
                  </div>

                  {c.notification_message && (
                    <div style={{
                      background: '#f0f9ff',
                      borderLeft: '3px solid #0284c7',
                      padding: '6px 8px',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      color: '#0369a1'
                    }}>
                      📢 <strong>Gov Action Update:</strong><br />
                      {c.notification_message}
                    </div>
                  )}

                  <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '6px' }}>
                    Reported: {new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>

        {/* Floating Legend / Hint */}
        <div style={{
          position: 'absolute',
          bottom: '12px',
          left: '12px',
          zIndex: 1000,
          background: 'rgba(15, 23, 42, 0.92)',
          backdropFilter: 'blur(6px)',
          padding: '6px 14px',
          borderRadius: '8px',
          fontSize: '0.75rem',
          border: '1px solid var(--border-subtle)',
          pointerEvents: 'none',
          display: 'flex',
          gap: '14px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
        }}>
          <span>💧 Blue Droplet: Active Grievance Pin (Draggable)</span>
          <span>📍 Pins: Your Raised Tickets ({userComplaints.length})</span>
        </div>
      </div>
    </div>
  );
}

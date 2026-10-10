export interface GeocodeResult {
  label: string;
  lat: number;
  lng: number;
}

/**
 * Searches for localities, colonies, streets and landmarks within Delhi using Nominatim/OpenStreetMap API.
 * Biased towards Delhi coordinates [28.6139, 77.2090].
 */
export async function searchDelhiAddress(query: string): Promise<GeocodeResult[]> {
  if (!query || query.trim().length < 2) return [];

  try {
    const encoded = encodeURIComponent(`${query.trim()}, Delhi, India`);
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encoded}&countrycodes=in&viewbox=76.8,28.9,77.4,28.4&bounded=1&limit=6`;
    
    const response = await fetch(url, {
      headers: {
        'Accept-Language': 'en',
      },
    });

    if (!response.ok) return [];
    const data = await response.json();

    return data.map((item: any) => ({
      label: item.display_name.split(',').slice(0, 3).join(', '),
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
    }));
  } catch (err) {
    console.error('Address search error:', err);
    return [];
  }
}

/**
 * Reverse geocodes latitude/longitude into a human-readable Delhi locality or street address.
 */
export async function reverseGeocodeDelhi(lat: number, lng: number): Promise<string | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=16&addressdetails=1`;
    const response = await fetch(url, {
      headers: {
        'Accept-Language': 'en',
      },
    });

    if (!response.ok) return null;
    const data = await response.json();

    if (data && data.address) {
      const a = data.address;
      const parts = [
        a.suburb || a.neighbourhood || a.residential || a.road || a.commercial,
        a.city_district || a.subdistrict || a.county || a.state_district,
      ].filter(Boolean);

      if (parts.length > 0) {
        return parts.join(', ');
      }
      return data.display_name.split(',').slice(0, 2).join(', ');
    }
    return null;
  } catch (err) {
    console.error('Reverse geocode error:', err);
    return null;
  }
}

const API_KEY = import.meta.env.VITE_GEOAPIFY_API_KEY as string;
const BASE_URL_V1 = import.meta.env.VITE_GEOAPIFY_BASE_URL_V1 as string;
const BASE_URL_V2 = import.meta.env.VITE_GEOAPIFY_BASE_URL_V2 as string;

export const geoService = {
  async getRoute(points: { lat: number; lng: number }[], mode: 'drive' | 'walk' | 'bicycle' = 'drive') {
    const waypoints = points.map((p) => `${p.lat},${p.lng}`).join('|');
    const response = await fetch(
      `${BASE_URL_V1}/routing?waypoints=${waypoints}&mode=${mode}&optimize=true&apiKey=${API_KEY}`
    );
    return await response.json();
  },

  async getMatrix(locations: { lat: number; lng: number }[]) {
    const body = {
      mode: 'drive',
      sources: locations.map((l) => ({ location: [l.lng, l.lat] })),
      targets: locations.map((l) => ({ location: [l.lng, l.lat] })),
    };

    const response = await fetch(`${BASE_URL_V1}/routematrix?apiKey=${API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return await response.json();
  },

  async geocode(text: string) {
    const response = await fetch(
      `${BASE_URL_V1}/geocode/search?text=${encodeURIComponent(text)}&apiKey=${API_KEY}`
    );
    return await response.json();
  },

  async getPlacesByBounds(filterRect: string) {
    const categories = [
      'tourism.attraction',
      'tourism.sights',
      'catering.restaurant',
      'catering.cafe',
      'leisure.park',
      'tourism.museum',
      'natural.beach',
      'entertainment',
      'production.factory',
      'commercial.food_and_drink'
    ].join(',');

    const url = `${BASE_URL_V2}/places?categories=${categories}&filter=rect:${filterRect}&limit=50&apiKey=${API_KEY}`;

    const response = await fetch(url);
    
    if (!response.ok) {
      console.error(`Geoapify error: ${response.status}`);
      return [];
    }

    const data = await response.json();

    return (data.features || []).map((feature: any) => ({
      id: feature.properties.place_id,
      name: feature.properties.name || feature.properties.address_line1 || 'Интересное место',
      lat: feature.properties.lat,
      lng: feature.properties.lon,
      description: feature.properties.formatted || '',
      address: feature.properties.address_line2 || '',
      placeTypes: feature.properties.categories || [],
      vacationTypes: [],
      activity: 'medium',
      rating: feature.properties.rating || 0,
      imageUrl: '', 
      website: feature.properties.website || '',
      phone: feature.properties.phone || '',
    }));
  },

  async searchPlaces(query: string, filterRect?: string) {
    let url = `${BASE_URL_V2}/places?text=${encodeURIComponent(query)}&apiKey=${API_KEY}`;

    if (filterRect) {
      url += `&filter=rect:${filterRect}`;
    }

    const response = await fetch(url);
    if (!response.ok) return [];
    
    const data = await response.json();

    return (data.features || []).map((feature: any) => ({
      id: feature.properties.place_id,
      name: feature.properties.name || 'Без названия',
      lat: feature.properties.lat,
      lng: feature.properties.lon,
      description: feature.properties.formatted || '',
      address: feature.properties.address_line1 || '',
      placeTypes: feature.properties.categories || [],
      vacationTypes: [],
      activity: 'medium',
      rating: feature.properties.rating || 0,
      imageUrl: '',
    }));
  },
};

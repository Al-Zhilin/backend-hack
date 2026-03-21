const API_KEY = '4e3793a793924e688abe127ce6b0549e';
const BASE_URL_V1 = 'https://api.geoapify.com/v1';
const BASE_URL_V2 = 'https://api.geoapify.com/v2';

export const geoService = {
  // 1. Построение маршрута (Routing API)
  async getRoute(points: { lat: number; lng: number }[]) {
    const waypoints = points.map((p) => `${p.lat},${p.lng}`).join('|');
    const response = await fetch(
      `${BASE_URL_V1}/routing?waypoints=${waypoints}&mode=drive&optimize=true&apiKey=${API_KEY}`
    );
    return await response.json();
  },

  // 2. Матрица расстояний (Route Matrix API)
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

  // 3. Геокодинг (Поиск координат по адресу)
  async geocode(text: string) {
    const response = await fetch(
      `${BASE_URL_V1}/geocode/search?text=${encodeURIComponent(text)}&apiKey=${API_KEY}`
    );
    return await response.json();
  },

  // 4. Поиск мест по границам (Places API V2)
  async getPlacesByBounds(filterRect: string) {
    // Расширенный список категорий: достопримечательности, еда, парки, фермы и сыроварни
    const categories = [
      'tourism.attraction',
      'tourism.sights',
      'catering.restaurant',
      'catering.cafe',
      'leisure.park',
      'tourism.museum',
      'natural.beach',
      'entertainment',
      'production.factory',       // Для сыроварен и производств
      'commercial.food_and_drink' // Для фермерских лавок и рынков
    ].join(',');

    // ВАЖНО: используем BASE_URL_V2 для фильтра rect
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
      lat: feature.properties.lat, // Используем готовые lat/lon из свойств
      lng: feature.properties.lon,
      description: feature.properties.formatted || '',
      address: feature.properties.address_line2 || '',
      placeTypes: feature.properties.categories || [],
      vacationTypes: [], // Оставляем пустым для твоей внутренней логики скоринга
      activity: 'medium',
      rating: feature.properties.rating || 0,
      imageUrl: '', 
      website: feature.properties.website || '',
      phone: feature.properties.phone || '',
    }));
  },

  // 5. Поиск мест с текстовым запросом (Places API V2)
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
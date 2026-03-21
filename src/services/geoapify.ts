const API_KEY = '4e3793a793924e688abe127ce6b0549e';
const BASE_URL = 'https://api.geoapify.com/v1';

export const geoService = {
  // 1. Построение маршрута (Routing API)
  async getRoute(points: {lat: number, lng: number}[]) {
    const waypoints = points.map(p => `${p.lat},${p.lng}`).join('|');
    const response = await fetch(
      `${BASE_URL}/routing?waypoints=${waypoints}&mode=drive&optimize=true&apiKey=${API_KEY}`
    );
    return await response.json();
  },

  // 2. Матрица расстояний (Route Matrix API) - POST запрос
  async getMatrix(locations: {lat: number, lng: number}[]) {
    const body = {
      mode: 'drive',
      sources: locations.map(l => ({ location: [l.lng, l.lat] })),
      targets: locations.map(l => ({ location: [l.lng, l.lat] }))
    };

    const response = await fetch(`${BASE_URL}/routematrix?apiKey=${API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    return await response.json();
  },

  // 3. Геокодинг (Поиск координат по адресу)
  async geocode(text: string) {
    const response = await fetch(
      `${BASE_URL}/geocode/search?text=${encodeURIComponent(text)}&apiKey=${API_KEY}`
    );
    return await response.json();
  },

  // 4. НОВЫЙ МЕТОД: Поиск мест по границам (Places API)
  async getPlacesByBounds(filterRect: string) {
    // filterRect формат: "minLon,minLat,maxLon,maxLat"
    // Пример: "37.5,44.5,39.5,45.5"
    
    // Категории мест, которые нас интересуют (можно настроить)
    const categories = [
      'tourism.attraction',      // достопримечательности
      'catering.restaurant',     // рестораны
      'catering.cafe',          // кафе
      'leisure.park',           // парки
      'tourism.museum',         // музеи
      'natural.beach',          // пляжи
      'natural.nature_reserve', // заповедники
      'entertainment'           // развлечения
    ];
    
    const categoriesParam = categories.join(',');
    
    // Фильтр по границам
    const boundsParam = filterRect;
    
    // Ограничиваем количество результатов (макс 100)
    const limit = 50;
    
    const response = await fetch(
      `${BASE_URL}/places?categories=${categoriesParam}&filter=rect:${boundsParam}&limit=${limit}&apiKey=${API_KEY}`
    );
    
    const data = await response.json();
    
    // Преобразуем ответ Geoapify в формат Location, который используется в приложении
    return data.features?.map((feature: any) => ({
      id: feature.properties.place_id || feature.properties.osm_id,
      name: feature.properties.name || 'Без названия',
      lat: feature.geometry.coordinates[1],
      lng: feature.geometry.coordinates[0],
      description: feature.properties.formatted || feature.properties.address_line1 || '',
      address: feature.properties.address_line1 || feature.properties.formatted || '',
      // Дополнительные поля, которые могут понадобиться
      placeTypes: feature.properties.categories || [],
      vacationTypes: [],
      activity: 'medium',
      rating: feature.properties.rating || 0,
      imageUrl: feature.properties.image_url || '',
      website: feature.properties.website || '',
      phone: feature.properties.phone || '',
    })) || [];
  },

  // 5. Альтернативный метод: поиск мест с текстовым запросом
  async searchPlaces(query: string, filterRect?: string) {
    let url = `${BASE_URL}/places?text=${encodeURIComponent(query)}&apiKey=${API_KEY}`;
    
    if (filterRect) {
      url += `&filter=rect:${filterRect}`;
    }
    
    const response = await fetch(url);
    const data = await response.json();
    
    return data.features?.map((feature: any) => ({
      id: feature.properties.place_id || feature.properties.osm_id,
      name: feature.properties.name || 'Без названия',
      lat: feature.geometry.coordinates[1],
      lng: feature.geometry.coordinates[0],
      description: feature.properties.formatted || '',
      address: feature.properties.address_line1 || '',
      placeTypes: feature.properties.categories || [],
      vacationTypes: [],
      activity: 'medium',
      rating: feature.properties.rating || 0,
      imageUrl: feature.properties.image_url || '',
    })) || [];
  }
};
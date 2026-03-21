const API_KEY = '4e3793a793924e688abe127ce6b0549e';
const BASE_URL = 'https://api.geoapify.com/v1';

export const geoService = {
  // 1. Построение маршрута (Routing API)
  async getRoute(points: {lat: number, lng: number}[]) {
    const waypoints = points.map(p => `${p.lat},${p.lng}`).join('|');
    // Добавляем &optimize=true. Это магически уберет "петли" и хаос.
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
  }
};
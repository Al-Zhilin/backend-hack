import { KUBAN_BOUNDS } from '../data/locations'

export function projectLatLngToXZ(lat: number, lng: number) {
  const { minLat, maxLat, minLng, maxLng } = KUBAN_BOUNDS

  const tLng = (lng - minLng) / (maxLng - minLng)
  const tLat = (lat - minLat) / (maxLat - minLat)

  // Плоскость карты: X - “восток”, Z - “север”
  const width = 10.8
  const depth = 6.8

  const x = tLng * width - width / 2
  const z = -(tLat * depth - depth / 2)

  return { x, z }
}


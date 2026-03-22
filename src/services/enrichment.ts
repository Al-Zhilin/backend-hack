import type { TourPoint } from '../components/generate/types'

const API_KEY = import.meta.env.VITE_GEOAPIFY_API_KEY as string
const BASE_V1 = import.meta.env.VITE_GEOAPIFY_BASE_URL_V1 as string

const cache = new Map<string, TourPoint>()

function cacheKey(p: TourPoint) {
  return `${p.lat.toFixed(5)}_${p.lng.toFixed(5)}`
}

async function reverseGeocode(lat: number, lng: number): Promise<Record<string, any> | null> {
  try {
    const url = `${BASE_V1}/geocode/reverse?lat=${lat}&lon=${lng}&apiKey=${API_KEY}`
    const res = await fetch(url)
    if (!res.ok) return null
    const data = await res.json()
    return data.features?.[0]?.properties ?? null
  } catch {
    return null
  }
}

export async function enrichTourPoint(point: TourPoint): Promise<TourPoint> {
  const key = cacheKey(point)
  const cached = cache.get(key)
  if (cached) return { ...point, ...cached }

  const props = await reverseGeocode(point.lat, point.lng)
  if (!props) return point

  const enriched: TourPoint = {
    ...point,
    address: point.address || props.formatted || props.address_line1 || point.address,
    phone: point.phone || props.contact?.phone || props.datasource?.raw?.phone || undefined,
    website: point.website || props.website || props.datasource?.raw?.website || undefined,
    workingHours: point.workingHours || props.opening_hours || props.datasource?.raw?.opening_hours || undefined,
  }

  cache.set(key, enriched)
  return enriched
}

export async function enrichTourPoints(points: TourPoint[]): Promise<TourPoint[]> {
  return Promise.all(points.map(enrichTourPoint))
}

import type { AuthProfile, GeneratedTrip, SeasonId } from '../types'

const KEY = 'kubanSmotry.profile.v1'
const KEY_TRIPS = 'kubanSmotry.trips.v1'

export function loadProfile(): AuthProfile | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as AuthProfile
    if (!parsed?.role || !parsed?.email || typeof parsed.createdAt !== 'number') return null
    return parsed
  } catch {
    return null
  }
}

export function saveProfile(profile: AuthProfile) {
  localStorage.setItem(KEY, JSON.stringify(profile))
}

export function clearProfile() {
  localStorage.removeItem(KEY)
}

export function loadTrips(): GeneratedTrip[] {
  try {
    const raw = localStorage.getItem(KEY_TRIPS)
    if (!raw) return []
    const parsed = JSON.parse(raw) as GeneratedTrip[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveTrips(trips: GeneratedTrip[]) {
  localStorage.setItem(KEY_TRIPS, JSON.stringify(trips))
}

export function isTravelerComplete(profile: AuthProfile | null): boolean {
  if (!profile) return false
  if (profile.role !== 'traveler') return true
  return Boolean(profile.interests?.displayName && profile.interests?.placeTypes)
}

export function formatSeason(season: SeasonId) {
  switch (season) {
    case 'spring':
      return 'Весна'
    case 'summer':
      return 'Лето'
    case 'autumn':
      return 'Осень'
    case 'winter':
      return 'Зима'
    default:
      return 'Любой сезон'
  }
}


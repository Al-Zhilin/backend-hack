// export type UserRole = 'traveler' | 'partner'

// export type SeasonId = 'spring' | 'summer' | 'autumn' | 'winter' | 'any'

// export type ActivityLevelId = 'low' | 'medium' | 'high'

// export type VacationTypeId =
//   | 'sea'
//   | 'mountains'
//   | 'nature'
//   | 'culture'
//   | 'gastro'
//   | 'wine'
//   | 'active'
//   | 'wellness'
//   | 'family'

// export type PlaceTypeId =
//   | 'wineries'
//   | 'cheese_farms'
//   | 'cossack_stations'
//   | 'eco_farms'
//   | 'reserves'
//   | 'trekking_routes'
//   | 'festivals'

// export type CompanionId = 'solo' | 'couple' | 'family' | 'elder' | 'friends' | 'freelancers'

// export interface Interests {
//   vacationTypes: VacationTypeId[]
//   placeTypes: PlaceTypeId[]
//   companions: CompanionId
//   season: SeasonId
//   activityLevel: ActivityLevelId
//   transferComfort: 'short' | 'balanced' | 'long'
//   displayName: string
// }

// export interface PartnerProfileStub {
//   locations: Array<{
//     id: string
//     name: string
//   }>
// }

// export interface AuthProfile {
//   role: UserRole
//   email: string
//   interests?: Interests
//   partner?: PartnerProfileStub
//   createdAt: number
// }

// export interface GeneratedTrip {
//   id: string
//   createdAt: number
//   season: SeasonId
//   days: number
//   routeVariants: Array<{
//     id: string
//     title: string
//     placeIds: string[]
//     timeline: Array<{
//       day: number
//       fromPlaceId: string
//       toPlaceId: string
//       transport: string
//       stay: string
//       food: string
//     }>
//     keyPlaceIds: string[]
//     score: number
//   }>
//   pickedVariantId?: string
// }




// src/types/index.ts
export type ActivityLevelId = 'low' | 'medium' | 'high'

export type PlaceTypeId =
  | 'wineries'
  | 'festivals'
  | 'cossack_stations'
  | 'cheese_farms'
  | 'eco_farms'
  | 'reserves'
  | 'trekking_routes'

export type VacationTypeId =
  | 'wine'
  | 'gastro'
  | 'culture'
  | 'family'
  | 'nature'
  | 'sea'
  | 'wellness'
  | 'mountains'
  | 'active'

export type SeasonId = 'spring' | 'summer' | 'autumn' | 'winter'

export interface Location {
  id: string
  name: string
  placeTypes: PlaceTypeId[]
  vacationTypes: VacationTypeId[]
  seasons: SeasonId[]
  activity: ActivityLevelId
  description: string
  photoUrl: string
  lat: number
  lng: number
  suitableFor: Array<'family' | 'elder' | 'freelancers' | 'friends' | 'couple'>

  photos?: string[]
  address?: string
  howToGet?: string

  vr_enabled?: boolean
  '360_photo_url'?: string
  youtube360_url?: string

  workingHours?: string
  contacts?: { phone?: string; site?: string; email?: string }
  prices?: string
  seasonality?: string[]
  recommendations?: string[]
  aiFullDescription?: string
}

export const KUBAN_BOUNDS = {
  minLat: 43.2,
  maxLat: 46.7,
  minLng: 36.5,
  maxLng: 41.3,
}
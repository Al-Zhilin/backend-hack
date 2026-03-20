export type UserRole = 'traveler' | 'partner'

export type SeasonId = 'spring' | 'summer' | 'autumn' | 'winter' | 'any'

export type ActivityLevelId = 'low' | 'medium' | 'high'

export type VacationTypeId =
  | 'sea'
  | 'mountains'
  | 'nature'
  | 'culture'
  | 'gastro'
  | 'wine'
  | 'active'
  | 'wellness'
  | 'family'

export type PlaceTypeId =
  | 'wineries'
  | 'cheese_farms'
  | 'cossack_stations'
  | 'eco_farms'
  | 'reserves'
  | 'trekking_routes'
  | 'festivals'

export type CompanionId = 'solo' | 'couple' | 'family' | 'elder' | 'friends' | 'freelancers'

export interface Interests {
  vacationTypes: VacationTypeId[]
  placeTypes: PlaceTypeId[]
  companions: CompanionId
  season: SeasonId
  activityLevel: ActivityLevelId
  transferComfort: 'short' | 'balanced' | 'long'
  displayName: string
}

export interface PartnerProfileStub {
  locations: Array<{
    id: string
    name: string
  }>
}

export interface AuthProfile {
  role: UserRole
  email: string
  interests?: Interests
  partner?: PartnerProfileStub
  createdAt: number
}

export interface GeneratedTrip {
  id: string
  createdAt: number
  season: SeasonId
  days: number
  routeVariants: Array<{
    id: string
    title: string
    placeIds: string[]
    timeline: Array<{
      day: number
      fromPlaceId: string
      toPlaceId: string
      transport: string
      stay: string
      food: string
    }>
    keyPlaceIds: string[]
    score: number
  }>
  pickedVariantId?: string
}


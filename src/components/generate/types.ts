export type TourPoint = {
  id: string
  name: string
  address: string
  lat: number
  lng: number
  description: string
  tags: string[]
  photoUrl?: string
  photos?: string[]
  phone?: string
  website?: string
  prices?: string
  seasonality?: string[]
  workingHours?: string
  panoramaAvailable?: boolean
  panoramaUrl?: string
}

export type Tour = {
  id: string
  title: string
  duration: number
  description: string
  price: string
  tags: string[]
  seasonality?: string[]
  points: TourPoint[]
  schedule?: RouteScheduleEntry[]
}

export type GenerateResponse = {
  tours: Tour[]
}

export type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  text: string
}

/** Место, предложенное бэкендом (PlaceItem из OpenAPI) */
export type SuggestedPlace = {
  id: string
  name: string
  lat: number
  lon: number
  address: string
  tag: string
}

/** Шаг маршрута из get_user_route */
export type RouteStep = {
  from: RouteStepNode
  to: RouteStepNode
  schedule?: RouteScheduleEntry
}

export type RouteStepNode = {
  id?: string
  name: string
  lat: number
  lon: number
  address?: string
  tag?: string
  panorama_url?: string
}

export type RouteScheduleEntry = {
  transport?: string
  departure?: string
  arrival?: string
  duration?: string
  [key: string]: unknown
}

/** Полный ответ get_user_route при статусе 200 */
export type UserRouteResponse = {
  route_steps: RouteStep[]
  title?: string
  description?: string
  duration?: number
  price?: string
  schedule?: RouteScheduleEntry[]
}

/** Полный ответ get_suggestions при статусе 200 */
export type SuggestionsResponse = {
  suggested_places: SuggestedPlace[]
  transport_mode?: string
}

export type FlowPhase =
  | 'idle'
  | 'chatting'
  | 'polling_suggestions'
  | 'suggestions_ready'
  | 'generating_route'
  | 'polling_route'
  | 'route_ready'


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

export type FlowPhase =
  | 'idle'
  | 'chatting'
  | 'polling_suggestions'
  | 'suggestions_ready'
  | 'generating_route'
  | 'polling_route'
  | 'route_ready'


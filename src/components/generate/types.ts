export type TourPoint = {
  id: string
  name: string
  address: string
  lat: number
  lng: number
  description: string
  tags: string[]
  photoUrl?: string
}

export type Tour = {
  id: string
  title: string
  duration: number
  description: string
  price: string
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


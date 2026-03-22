export type PlaceReview = {
  id: string
  placeId: string
  authorName: string
  rating: number
  text: string
  createdAt: number
}

const KEY = 'kubanSmotry.reviews.v1'

function loadRaw(): Record<string, PlaceReview[]> {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return {}
    const p = JSON.parse(raw) as Record<string, PlaceReview[]>
    return p && typeof p === 'object' ? p : {}
  } catch {
    return {}
  }
}

function saveRaw(data: Record<string, PlaceReview[]>) {
  localStorage.setItem(KEY, JSON.stringify(data))
}

export function getReviewsForPlace(placeId: string): PlaceReview[] {
  const all = loadRaw()
  return [...(all[placeId] ?? [])].sort((a, b) => b.createdAt - a.createdAt)
}

export function getAverageRating(placeId: string): number | null {
  const list = getReviewsForPlace(placeId)
  if (!list.length) return null
  return list.reduce((s, r) => s + r.rating, 0) / list.length
}

export function addReview(placeId: string, authorName: string, rating: number, text: string): PlaceReview {
  const all = loadRaw()
  const review: PlaceReview = {
    id: `rv_${Math.random().toString(36).slice(2, 10)}_${Date.now()}`,
    placeId,
    authorName: authorName.trim() || 'Гость',
    rating: Math.min(5, Math.max(1, Math.round(rating))),
    text: text.trim(),
    createdAt: Date.now(),
  }
  const prev = all[placeId] ?? []
  all[placeId] = [review, ...prev]
  saveRaw(all)
  return review
}

export function averageRatingForPlaceIds(placeIds: string[]): number | null {
  const ratings: number[] = []
  for (const id of placeIds) {
    const avg = getAverageRating(id)
    if (avg != null) ratings.push(avg)
  }
  if (!ratings.length) return null
  return ratings.reduce((a, b) => a + b, 0) / ratings.length
}

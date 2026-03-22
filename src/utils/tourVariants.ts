import type { Interests, PlaceTypeId, VacationTypeId } from '../types'
import type { SuggestedPlace } from '../components/generate/types'

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function tagBucket(tag: string, name: string): 'gastro' | 'nature' | 'culture' | 'other' {
  const s = `${tag} ${name}`.toLowerCase()
  if (/вин|сыр|ресторан|кафе|бар|гастро|еда|кухн|дегуст/.test(s)) return 'gastro'
  if (/парк|лес|заповед|пляж|мор|гор|трек|природ|эко|ферм|нац/.test(s)) return 'nature'
  if (/музей|культур|памятник|истори|храм|достопримеч/.test(s)) return 'culture'
  return 'other'
}

function scorePlace(sp: SuggestedPlace, interests: Interests | null | undefined): number {
  if (!interests) return 5
  let score = 0
  const blob = `${sp.tag} ${sp.name}`.toLowerCase()

  for (const vt of interests.vacationTypes ?? []) {
    const kw: Record<VacationTypeId, RegExp> = {
      wine: /вин|дегуст/,
      gastro: /ресторан|кафе|еда|гастро|сыр|кухн/,
      culture: /музей|культур|истори/,
      family: /парк|детск|семь/,
      nature: /парк|природ|лес|заповед|мор|эко/,
      sea: /мор|пляж/,
      wellness: /спа|оздоров|база отдых/,
      mountains: /гор|трек|ущель/,
      active: /трек|поход|спорт/,
    }
    if (kw[vt]?.test(blob)) score += 12
  }

  const tagToType: Array<{ re: RegExp; t: PlaceTypeId }> = [
    { re: /вин|дегуст/, t: 'wineries' },
    { re: /сыр|молоч|сыровар/, t: 'cheese_farms' },
    { re: /парк|заповед|лес|пляж/, t: 'reserves' },
    { re: /музей|культур/, t: 'cultural_sites' },
    { re: /гост|отел|хостел/, t: 'guest_houses' },
    { re: /трек|поход|гор/, t: 'trekking_routes' },
  ]
  for (const { re, t } of tagToType) {
    if (re.test(blob) && interests.placeTypes?.includes(t)) score += 15
  }

  return score + Math.min(10, sp.name.length / 8)
}

function orderByScore(places: SuggestedPlace[], interests: Interests | null | undefined, maxN: number): string[] {
  return [...places]
    .sort((a, b) => scorePlace(b, interests) - scorePlace(a, interests))
    .slice(0, maxN)
    .map((p) => p.id)
}

function orderDiversity(places: SuggestedPlace[], maxN: number): string[] {
  const buckets = new Map<string, SuggestedPlace[]>()
  for (const p of places) {
    const b = tagBucket(p.tag, p.name)
    if (!buckets.has(b)) buckets.set(b, [])
    buckets.get(b)!.push(p)
  }
  const order: string[] = []
  const keys = ['gastro', 'nature', 'culture', 'other'] as const
  let round = 0
  while (order.length < maxN && order.length < places.length) {
    let added = false
    for (const k of keys) {
      const list = buckets.get(k)
      if (list && list[round]) {
        const p = list[round]
        if (!order.includes(p.id)) {
          order.push(p.id)
          added = true
        }
      }
    }
    if (!added) break
    round++
  }
  for (const p of places) {
    if (order.length >= maxN) break
    if (!order.includes(p.id)) order.push(p.id)
  }
  return order
}

function orderNearest(
  places: SuggestedPlace[],
  start: { lat: number; lon: number },
  maxN: number,
): string[] {
  const remaining = new Set(places.map((p) => p.id))
  const byId = new Map(places.map((p) => [p.id, p] as const))
  const out: string[] = []
  let curLat = start.lat
  let curLon = start.lon
  while (remaining.size && out.length < maxN) {
    let bestId: string | null = null
    let bestD = Infinity
    for (const id of remaining) {
      const p = byId.get(id)!
      const d = haversineKm(curLat, curLon, p.lat, p.lon)
      if (d < bestD) {
        bestD = d
        bestId = id
      }
    }
    if (!bestId) break
    remaining.delete(bestId)
    out.push(bestId)
    const p = byId.get(bestId)!
    curLat = p.lat
    curLon = p.lon
  }
  return out
}

function orderBalanced(places: SuggestedPlace[], maxN: number): string[] {
  const gastro: SuggestedPlace[] = []
  const nature: SuggestedPlace[] = []
  const culture: SuggestedPlace[] = []
  const other: SuggestedPlace[] = []
  for (const p of places) {
    switch (tagBucket(p.tag, p.name)) {
      case 'gastro':
        gastro.push(p)
        break
      case 'nature':
        nature.push(p)
        break
      case 'culture':
        culture.push(p)
        break
      default:
        other.push(p)
    }
  }
  const pools = [gastro, nature, culture, other]
  const out: string[] = []
  let i = 0
  while (out.length < maxN && out.length < places.length) {
    const next = pools[i % 4].find((p) => !out.includes(p.id))
    if (next) out.push(next.id)
    else {
      const any = places.find((p) => !out.includes(p.id))
      if (any) out.push(any.id)
      else break
    }
    i++
  }
  return out
}

export type TourVariantPreview = {
  id: string
  strategy: 'score' | 'diversity' | 'nearest' | 'balanced'
  title: string
  subtitle: string
  orderedPlaceIds: string[]
}

function titleFromPrompt(prompt: string): { theme: string } {
  const lower = prompt.toLowerCase()
  if (/романт|пар|вин|уикенд/.test(lower)) return { theme: 'романтика и гастрономия' }
  if (/семь|дет|ребён|дети/.test(lower)) return { theme: 'семейный отдых' }
  if (/актив|трек|поход|спорт/.test(lower)) return { theme: 'активный отдых' }
  if (/мор|пляж/.test(lower)) return { theme: 'море и побережье' }
  return { theme: 'открытия Кубани' }
}

export function buildFourTourVariants(
  places: SuggestedPlace[],
  options: {
    interests: Interests | null | undefined
    prompt: string
    startPoint: { lat: number; lon: number } | null
    maxPoints?: number
  },
): TourVariantPreview[] {
  if (!places.length) return []
  const maxPoints = Math.min(options.maxPoints ?? 8, places.length, 12)
  const start = options.startPoint ?? { lat: places[0].lat, lon: places[0].lon }
  const { theme } = titleFromPrompt(options.prompt)

  const scoreIds = orderByScore(places, options.interests, maxPoints)
  const diversityIds = orderDiversity(places, maxPoints)
  const nearestIds = orderNearest(places, start, maxPoints)
  const balancedIds = orderBalanced(places, maxPoints)

  return [
    {
      id: 'var_score',
      strategy: 'score',
      title: `Лучшее по запросу: ${theme}`,
      subtitle: 'Подбор по совпадению с вашими интересами и типами мест',
      orderedPlaceIds: scoreIds,
    },
    {
      id: 'var_diversity',
      strategy: 'diversity',
      title: 'Разнообразный маршрут',
      subtitle: 'Гастрономия, природа и культура в одной поездке',
      orderedPlaceIds: diversityIds,
    },
    {
      id: 'var_nearest',
      strategy: 'nearest',
      title: 'Минимум дороги',
      subtitle: 'Порядок точек от старта по ближайшему соседу',
      orderedPlaceIds: nearestIds,
    },
    {
      id: 'var_balanced',
      strategy: 'balanced',
      title: 'Сбалансированный сценарий',
      subtitle: 'Чередование «еда — природа — культура»',
      orderedPlaceIds: balancedIds,
    },
  ]
}

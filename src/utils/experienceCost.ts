import type { PlaceTypeId } from '../types'

/** Парсит первое число «от N» / «N ₽» из строки цен */
export function parseRubFromPriceString(s: string | undefined): number | null {
  if (!s?.trim()) return null
  const m = s.match(/(?:от\s*)?(\d[\d\s]*)\s*₽/i) || s.match(/(\d{3,})\s*(?:₽|руб)/i)
  if (!m) {
    const digits = s.replace(/\s/g, '').match(/\d{2,}/)
    return digits ? parseInt(digits[0], 10) : null
  }
  return parseInt(m[1].replace(/\s/g, ''), 10)
}

const FALLBACK_ENTRY_RUB: Partial<Record<PlaceTypeId, [number, number]>> = {
  wineries: [800, 2500],
  cheese_farms: [400, 1200],
  restaurants_cafes: [800, 2500],
  reserves: [0, 500],
  trekking_routes: [0, 800],
  kids_entertainment: [500, 2000],
  guest_houses: [2500, 8000],
  cultural_sites: [200, 800],
  eco_farms: [300, 1500],
  cossack_stations: [0, 500],
  festivals: [500, 3000],
}

export type ExperienceCostLine = {
  key: string
  label: string
  minRub: number
  maxRub: number
}

export type ExperienceCostEstimate = {
  lines: ExperienceCostLine[]
  totalMinRub: number
  totalMaxRub: number
  summaryLabel: string
}

type PointLike = {
  prices?: string
  tags?: string[]
}

function tagHeuristicEntryRange(tag: string): [number, number] {
  const t = tag.toLowerCase()
  if (/вин|дегуст|гастро|ресторан|кафе|еда/.test(t)) return [600, 2200]
  if (/парк|природ|заповед|мор|пляж|гор|трек|поход/.test(t)) return [0, 600]
  if (/музей|культур|истори|экскурс/.test(t)) return [200, 900]
  if (/отел|гост|ночев|жиль/.test(t)) return [2000, 9000]
  return [300, 1500]
}

function entryRangeForPoint(p: PointLike, placeTypes?: PlaceTypeId[]): [number, number] {
  const parsed = parseRubFromPriceString(p.prices)
  if (parsed != null) return [Math.max(0, Math.round(parsed * 0.85)), Math.round(parsed * 1.4)]

  if (placeTypes?.length) {
    let sumMin = 0
    let sumMax = 0
    let n = 0
    for (const pt of placeTypes) {
      const fb = FALLBACK_ENTRY_RUB[pt]
      if (fb) {
        sumMin += fb[0]
        sumMax += fb[1]
        n++
      }
    }
    if (n) return [Math.round(sumMin / n), Math.round(sumMax / n)]
  }

  for (const tag of p.tags ?? []) {
    return tagHeuristicEntryRange(tag)
  }
  return [400, 1500]
}

export function estimateExperienceCost(input: {
  points: PointLike[]
  /** топливо и прочее из estimateRoute */
  transportRub: number
  /** календарные дни поездки */
  tripDays: number
  /** людей (питание умножается) */
  people?: number
  placeTypesPerPoint?: Array<PlaceTypeId[] | undefined>
}): ExperienceCostEstimate {
  const people = Math.max(1, input.people ?? 2)
  const days = Math.max(1, input.tripDays)

  const lines: ExperienceCostLine[] = []

  let entriesMin = 0
  let entriesMax = 0
  input.points.forEach((p, i) => {
    const pt = input.placeTypesPerPoint?.[i]
    const [mn, mx] = entryRangeForPoint(p, pt)
    entriesMin += mn
    entriesMax += mx
  })
  lines.push({
    key: 'entries',
    label: 'Входы и активности (оценка)',
    minRub: entriesMin,
    maxRub: entriesMax,
  })

  const foodPerPersonDay: [number, number] = [1800, 3500]
  const foodMin = foodPerPersonDay[0] * people * days
  const foodMax = foodPerPersonDay[1] * people * days
  lines.push({
    key: 'food',
    label: `Питание (~${people} чел. × ${days} дн.)`,
    minRub: foodMin,
    maxRub: foodMax,
  })

  if (days > 1) {
    const nights = days - 1
    const lodgeMin = 2200 * nights
    const lodgeMax = 7500 * nights
    lines.push({
      key: 'lodging',
      label: `Проживание (${nights} ноч.)`,
      minRub: lodgeMin,
      maxRub: lodgeMax,
    })
  }

  if (input.transportRub > 0) {
    lines.push({
      key: 'transport',
      label: 'Транспорт (топливо, оценка)',
      minRub: input.transportRub,
      maxRub: Math.round(input.transportRub * 1.15),
    })
  }

  const totalMin = lines.reduce((s, l) => s + l.minRub, 0)
  const totalMax = lines.reduce((s, l) => s + l.maxRub, 0)
  return {
    lines,
    totalMinRub: totalMin,
    totalMaxRub: totalMax,
    summaryLabel:
      totalMin === totalMax
        ? `≈ ${totalMin.toLocaleString('ru-RU')} ₽`
        : `от ${totalMin.toLocaleString('ru-RU')} до ${totalMax.toLocaleString('ru-RU')} ₽`,
  }
}

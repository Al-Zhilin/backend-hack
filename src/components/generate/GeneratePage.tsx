import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { AuthProfile } from '../../types'

import ChatInput from './ChatInput'
import PlaceModal from './PlaceModal'
import TourMap from './TourMap'
import type { ChatMessage, FlowPhase, RouteStep, SuggestedPlace, Tour, TourPoint } from './types'
import { enrichTourPoints } from '../../services/enrichment'
import { loadTrips, saveTrips } from '../../utils/storage'
import Preloader from '../Preloader'
import '../../styles/generate.scss'

const API_BASE = import.meta.env.VITE_BACKEND_API_URL as string

const QUICK_PROMPTS = [
  'Семья с двумя детьми, 4 дня, море и экскурсии, бюджет средний',
  'Романтический уикенд: винодельни и гастрономия',
  'Активный тур на 3 дня: треккинг и природа без машины',
]

function makeId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}_${Date.now()}`
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

type RouteEstimate = {
  totalKm: number
  travelMinutes: number
  visitMinutes: number
  totalMinutes: number
  costRub: number
}

function estimateRoute(
  points: Array<{ lat: number; lng?: number; lon?: number }>,
  mode: 'auto' | 'pedestrian' | 'bicycle',
): RouteEstimate {
  let totalKm = 0
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i], b = points[i + 1]
    totalKm += haversineKm(a.lat, a.lng ?? a.lon ?? 0, b.lat, b.lng ?? b.lon ?? 0)
  }
  totalKm *= 1.3

  const speedKmH = mode === 'auto' ? 35 : mode === 'bicycle' ? 15 : 5
  const travelMinutes = Math.round((totalKm / speedKmH) * 60)

  const visitMinutes = points.length * 25

  const totalMinutes = travelMinutes + visitMinutes

  let costRub = 0
  if (mode === 'auto') {
    const fuelPer100 = 9
    const fuelPrice = 58
    costRub = Math.round((totalKm / 100) * fuelPer100 * fuelPrice)
  } else if (mode === 'bicycle') {
    costRub = 0
  }

  return { totalKm, travelMinutes, visitMinutes, totalMinutes, costRub }
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} мин`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m ? `${h} ч ${m} мин` : `${h} ч`
}

function suggestedToTourPoint(sp: SuggestedPlace): TourPoint {
  return {
    id: sp.id,
    name: sp.name,
    address: sp.address,
    lat: sp.lat,
    lng: sp.lon,
    description: '',
    tags: sp.tag ? [sp.tag] : [],
  }
}

function nodeToTourPoint(node: any, fallbackId: string): TourPoint {
  return {
    id: node.id || fallbackId,
    name: node.name || 'Точка',
    address: node.address || '',
    lat: node.lat,
    lng: node.lon ?? node.lng,
    description: node.description || '',
    tags: node.tag ? [node.tag] : (node.tags || []),
    panoramaUrl: node.panorama_url,
  }
}

function routeResponseToPoints(data: any): TourPoint[] {
  if (Array.isArray(data.route_steps)) {
    const steps = data.route_steps as RouteStep[]
    const seen = new Set<string>()
    const points: TourPoint[] = []
    for (const step of steps) {
      const fromKey = `${step.from.lat}_${step.from.lon}`
      if (!seen.has(fromKey)) {
        seen.add(fromKey)
        points.push(nodeToTourPoint(step.from, makeId('p')))
      }
      const toKey = `${step.to.lat}_${step.to.lon}`
      if (!seen.has(toKey)) {
        seen.add(toKey)
        points.push(nodeToTourPoint(step.to, makeId('p')))
      }
    }
    return points
  }

  let raw: any[] = []
  if (Array.isArray(data.points)) raw = data.points
  else if (Array.isArray(data.route)) raw = data.route
  else if (Array.isArray(data)) raw = data
  return raw.map((p: any) => nodeToTourPoint(p, makeId('p')))
}

const POLL_SUGGESTIONS_INTERVAL = 3_000
const POLL_SUGGESTIONS_MAX = 60
const POLL_ROUTE_INTERVAL = 2_000
const POLL_ROUTE_MAX = 45

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  'музей': ['музе', 'выставк', 'галере'],
  'кофейня': ['кофе', 'кафе', 'кафетер'],
  'парк': ['парк', 'сквер', 'рощ', 'сад '],
  'ресторан': ['рестора', 'еда', 'гастро', 'кухн'],
  'пляж': ['пляж', 'мор', 'купа'],
  'достопримечательность': ['экскурс', 'достопримечат', 'памятник', 'истори', 'культур'],
  'природа': ['природ', 'гор', 'трек', 'поход', 'актив'],
  'винодельня': ['вин', 'дегуста'],
  'развлечения': ['развлеч', 'детск', 'семь', 'аттракцион'],
}

const TRANSPORT_KEYWORDS: Record<string, string[]> = {
  'пешеход': ['пеш', 'прогул', 'ходь'],
  'авто': ['машин', 'авто', 'такси', 'ехать'],
  'общественный транспорт': ['общественн', 'автобус', 'трамвай', 'транспорт'],
}

const CITY_KEYWORDS: Record<string, string[]> = {
  'Краснодар': ['краснодар'],
  'Сочи': ['сочи', 'адлер'],
  'Анапа': ['анап'],
  'Геленджик': ['геленджик'],
  'Новороссийск': ['новоросс'],
  'Туапсе': ['туапсе'],
}

function extractTagsFromPrompt(prompt: string) {
  const lower = prompt.toLowerCase()

  const categories: string[] = []
  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(kw => lower.includes(kw))) categories.push(cat)
  }
  if (!categories.length) categories.push('достопримечательность', 'кофейня')

  let transport = 'пешеход'
  for (const [mode, keywords] of Object.entries(TRANSPORT_KEYWORDS)) {
    if (keywords.some(kw => lower.includes(kw))) { transport = mode; break }
  }

  let city = 'Краснодар'
  for (const [name, keywords] of Object.entries(CITY_KEYWORDS)) {
    if (keywords.some(kw => lower.includes(kw))) { city = name; break }
  }

  return { start_location: city, transport_mode: transport, categories }
}

export default function GeneratePage(props: { profile: AuthProfile; onPickRoute: (points: TourPoint[]) => void }) {
  const login = props.profile.email ?? 'user'

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: makeId('m'),
      role: 'assistant',
      text: 'Опишите поездку: длительность, формат отдыха, кто едет, бюджет и пожелания — я предложу несколько маршрутов по Кубани.',
    },
  ])
  const [phase, setPhase] = useState<FlowPhase>('idle')
  const [error, setError] = useState<string | null>(null)

  const [suggestions, setSuggestions] = useState<SuggestedPlace[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [startPoint, setStartPoint] = useState<{ name: string; lat: number; lon: number } | null>(null)

  const [tour, setTour] = useState<Tour | null>(null)
  const routeRequestedAtRef = useRef('')
  const [selectedPoint, setSelectedPoint] = useState<TourPoint | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [routeMode, setRouteMode] = useState<'auto' | 'pedestrian' | 'bicycle'>('pedestrian')
  const routeModeRef = useRef(routeMode)
  useEffect(() => { routeModeRef.current = routeMode }, [routeMode])

  const [chatDraft, setChatDraft] = useState('')
  const [lastPrompt, setLastPrompt] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const pollGenRef = useRef(0)

  const loading = phase !== 'idle' && phase !== 'suggestions_ready' && phase !== 'route_ready'

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => () => { pollGenRef.current++ }, [])

  /* ---------- polling: suggestions ---------- */
  const pollSuggestions = useCallback(async (pollId: number) => {
    for (let i = 0; i < POLL_SUGGESTIONS_MAX; i++) {
      if (pollGenRef.current !== pollId) return

      try {
        const res = await fetch(`${API_BASE}/api/get_suggestions/${encodeURIComponent(login)}`)

        if (res.status === 404) {
          await new Promise(r => setTimeout(r, POLL_SUGGESTIONS_INTERVAL))
          continue
        }

        if (!res.ok) {
          await new Promise(r => setTimeout(r, POLL_SUGGESTIONS_INTERVAL))
          continue
        }

        const data = await res.json()

        let places: SuggestedPlace[] = []
        if (Array.isArray(data)) places = data
        else if (Array.isArray(data.suggested_places)) places = data.suggested_places
        else if (Array.isArray(data.places)) places = data.places

        if (places.length > 0) {
          setSuggestions(places)
          setSelectedIds(new Set(places.map(p => p.id)))
          if (data.transport_mode) {
            const lower = (data.transport_mode as string).toLowerCase()
            if (lower.includes('пеш') || lower.includes('walk')) setRouteMode('pedestrian')
            else if (lower.includes('вело') || lower.includes('bicycl')) setRouteMode('bicycle')
            else if (lower.includes('авто') || lower.includes('drive') || lower.includes('машин')) setRouteMode('auto')
          }
          if (data.start_point) setStartPoint(data.start_point)
          setPhase('suggestions_ready')
          setMessages(prev => [
            ...prev,
            { id: makeId('m'), role: 'assistant', text: `Подобрано ${places.length} мест. Выберите нужные и нажмите «Построить маршрут».` },
          ])
        } else {
          setPhase('idle')
          setMessages(prev => [
            ...prev,
            { id: makeId('m'), role: 'assistant', text: 'Не удалось подобрать подходящие места. Попробуйте переформулировать запрос.' },
          ])
        }
        return
      } catch {
        await new Promise(r => setTimeout(r, POLL_SUGGESTIONS_INTERVAL))
      }
    }

    if (pollGenRef.current === pollId) {
      setPhase('idle')
      setError('Время ожидания подбора мест истекло. Попробуйте ещё раз.')
    }
  }, [login])

  /* ---------- polling: route ---------- */
  const pollRoute = useCallback(async (pollId: number) => {
    for (let i = 0; i < POLL_ROUTE_MAX; i++) {
      if (pollGenRef.current !== pollId) return

      try {
        const res = await fetch(`${API_BASE}/api/get_user_route/${encodeURIComponent(login)}`)

        if (res.status === 404) {
          await new Promise(r => setTimeout(r, POLL_ROUTE_INTERVAL))
          continue
        }

        if (!res.ok) {
          await new Promise(r => setTimeout(r, POLL_ROUTE_INTERVAL))
          continue
        }

        const data = await res.json()

        if (routeRequestedAtRef.current && data.created_at) {
          const routeTime = new Date(data.created_at).getTime()
          const requestTime = new Date(routeRequestedAtRef.current).getTime()
          if (routeTime < requestTime) {
            await new Promise(r => setTimeout(r, POLL_ROUTE_INTERVAL))
            continue
          }
        }

        const points = routeResponseToPoints(data)

        if (points.length) {
          const enriched = await enrichTourPoints(points)
          const newTour: Tour = {
            id: makeId('tour'),
            title: data.title || 'Ваш маршрут',
            duration: data.duration || Math.ceil(points.length / 3),
            description: data.description || `Маршрут из ${points.length} мест`,
            price: data.price || '',
            tags: [],
            points: enriched,
            schedule: data.schedule,
          }
          setTour(newTour)
          setPhase('route_ready')

          try {
            const currentMode = routeModeRef.current
            const est = estimateRoute(enriched, currentMode)
            const trip: import('../../types').GeneratedTrip = {
              id: newTour.id,
              createdAt: Date.now(),
              season: 'any' as import('../../types').SeasonId,
              days: Math.max(1, Math.ceil(est.totalMinutes / 480)),
              routeVariants: [{
                id: newTour.id,
                title: newTour.title,
                placeIds: enriched.map(p => p.id),
                timeline: [],
                keyPlaceIds: enriched.slice(0, 3).map(p => p.id),
                score: 0,
              }],
              tourPoints: enriched.map(p => ({
                id: p.id, name: p.name, address: p.address,
                lat: p.lat, lng: p.lng, tags: p.tags,
              })),
              transportMode: currentMode === 'pedestrian' ? 'Пешком' : currentMode === 'bicycle' ? 'Велосипед' : 'Авто',
              totalKm: Math.round(est.totalKm * 10) / 10,
              totalMinutes: est.totalMinutes,
            }
            const existing = loadTrips()
            saveTrips([...existing, trip])
          } catch { /* не блокируем UI */ }

          return
        }

        setPhase('suggestions_ready')
        setError('Не удалось получить маршрут. Попробуйте ещё раз.')
        return
      } catch {
        await new Promise(r => setTimeout(r, POLL_ROUTE_INTERVAL))
      }
    }

    if (pollGenRef.current === pollId) {
      setPhase('suggestions_ready')
      setError('Время ожидания маршрута истекло.')
    }
  }, [login, props])

  /* ---------- actions ---------- */
  const sendPrompt = async (prompt: string) => {
    setError(null)
    setPhase('chatting')
    setLastPrompt(prompt)
    setSuggestions([])
    setSelectedIds(new Set())
    setStartPoint(null)
    setTour(null)

    setMessages(prev => [...prev, { id: makeId('m'), role: 'user', text: prompt }])

    try {
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ login, text: prompt }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const raw = await res.text()
      let reply: string
      try {
        const json = JSON.parse(raw.trim())
        reply = typeof json === 'string'
          ? json.trim()
          : ((json.response ?? json.text ?? json.message ?? raw) as string).trim()
      } catch {
        reply = raw.trim()
      }

      setMessages(prev => [...prev, { id: makeId('m'), role: 'assistant', text: reply || 'Запрос обработан.' }])

      const tags = extractTagsFromPrompt(prompt)
      setPhase('polling_suggestions')

      try {
        await fetch(`${API_BASE}/api/receive_tour_data`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            login,
            status: 'completed',
            collected_tags: tags,
          }),
        })
      } catch { /* бэкенд может быть медленным, не блокируем */ }

      const pollId = ++pollGenRef.current
      void pollSuggestions(pollId)
    } catch (e) {
      setError(`Ошибка: ${(e as Error).message || 'Сервис недоступен'}`)
      setMessages(prev => [
        ...prev,
        { id: makeId('m'), role: 'assistant', text: 'Сервис временно недоступен. Попробуйте ещё раз.' },
      ])
      setPhase('idle')
    }
  }

  const handleGenerateRoute = async () => {
    if (!selectedIds.size) return
    setError(null)
    setPhase('generating_route')

    routeRequestedAtRef.current = new Date().toISOString()

    const selected = suggestions.filter(p => selectedIds.has(p.id))
    const sp = startPoint ?? { name: selected[0].name, lat: selected[0].lat, lon: selected[0].lon }

    try {
      const res = await fetch(`${API_BASE}/api/generate_route`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          login,
          transport_mode: routeMode === 'pedestrian' ? 'пешеход' : routeMode === 'bicycle' ? 'велосипед' : 'авто',
          start_point: sp,
          suggested_places: selected,
        }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      setPhase('polling_route')
      const pollId = ++pollGenRef.current
      void pollRoute(pollId)
    } catch (e) {
      setError(`Ошибка генерации маршрута: ${(e as Error).message}`)
      setPhase('suggestions_ready')
    }
  }

  const togglePlace = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const previewTour = useMemo<Tour | null>(() => {
    if (tour) return tour
    if (!suggestions.length || phase === 'idle' || phase === 'chatting') return null
    const selected = suggestions.filter(p => selectedIds.has(p.id))
    if (!selected.length) return null
    return {
      id: 'preview',
      title: 'Предпросмотр',
      duration: 0,
      description: '',
      price: '',
      tags: [],
      points: selected.map(suggestedToTourPoint),
    }
  }, [suggestions, selectedIds, tour, phase])

  const routeEstimate = useMemo<RouteEstimate | null>(() => {
    const pts = previewTour?.points
    if (!pts || pts.length < 2) return null
    return estimateRoute(pts, routeMode)
  }, [previewTour, routeMode])

  /* ---------- render ---------- */
  const phaseLabel = (): { label: string; sublabel: string } => {
    switch (phase) {
      case 'chatting': return { label: 'Запрос к серверу…', sublabel: 'Ждём ответ нейросети' }
      case 'polling_suggestions': return { label: 'Подбираем места…', sublabel: 'ИИ анализирует запрос и ищет подходящие точки' }
      case 'generating_route': return { label: 'Генерация маршрута…', sublabel: 'Строим оптимальный маршрут' }
      case 'polling_route': return { label: 'Ожидание маршрута…', sublabel: 'Сервер рассчитывает маршрут по дорогам' }
      default: return { label: '', sublabel: '' }
    }
  }

  return (
    <div className="page generatePage">
      <header className="generateHero">
        <p className="generateHero__eyebrow">ИИ-планировщик</p>
        <h1 className="generateHero__title">Сгенерировать тур</h1>
        <p className="generateHero__lead">
          Расскажите о поездке своими словами — мы подберём маршруты по Краснодарскому краю и покажем их на карте.
        </p>
      </header>

      <div className="generateLayout">
        {/* ===== Chat column ===== */}
        <div className="generateChatCol">
          <section className="generateChatCard" aria-label="Чат с ассистентом">
            <div className="generateChatCard__top">
              <div className="generateChatCard__avatar" aria-hidden><span>AI</span></div>
              <div>
                <h2 className="generateChatCard__title">Диалог</h2>
                <p className="generateChatCard__subtitle">Естественный язык · уточняйте детали</p>
              </div>
            </div>

            <div className="generateMessages" role="log" aria-live="polite">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={m.role === 'user' ? 'generateBubble generateBubble--user' : 'generateBubble generateBubble--assistant'}
                >
                  <p className="generateBubble__text">{m.text}</p>
                </div>
              ))}
              <div ref={messagesEndRef} className="generateMessages__anchor" aria-hidden />
            </div>

            {suggestions.length === 0 && !tour && !loading && (
              <div className="generateQuickChips" role="group" aria-label="Быстрые примеры запросов">
                {QUICK_PROMPTS.map((text) => (
                  <button key={text} type="button" className="generateQuickChip" onClick={() => setChatDraft(text)}>
                    {text}
                  </button>
                ))}
              </div>
            )}

            <div className="generateChatCard__footer">
              <ChatInput loading={loading} value={chatDraft} onValueChange={setChatDraft} onSend={sendPrompt} />
              {error && <div className="generateAlert">{error}</div>}
              {lastPrompt && !loading && (
                <button type="button" className="generateRegen" onClick={() => void sendPrompt(lastPrompt)}>
                  <span className="generateRegen__icon" aria-hidden>↻</span>
                  Повторить запрос
                </button>
              )}
            </div>
          </section>
        </div>

        {/* ===== Right column ===== */}
        <div className="generateRightCol">
          {loading && (
            <div className="generateRightColOverlay" aria-hidden={false}>
              <Preloader variant="overlay" label={phaseLabel().label} sublabel={phaseLabel().sublabel} />
            </div>
          )}

          {/* --- Предложенные места --- */}
          {suggestions.length > 0 && !tour && (
            <section className="generatePanel">
              <div className="generatePanel__head">
                <h2 className="generatePanel__title">Предложенные места</h2>
                <p className="generatePanel__desc">
                  Отметьте места, которые хотите включить в маршрут ({selectedIds.size} из {suggestions.length})
                </p>
              </div>

              <div className="suggestionsGrid">
                {suggestions.map((sp) => {
                  const active = selectedIds.has(sp.id)
                  return (
                    <label key={sp.id} className={`suggestionCard ${active ? 'suggestionCard--active' : ''}`}>
                      <input
                        type="checkbox"
                        checked={active}
                        onChange={() => togglePlace(sp.id)}
                        className="suggestionCard__check"
                      />
                      <div className="suggestionCard__body">
                        <div className="suggestionCard__name">{sp.name}</div>
                        {sp.address && <div className="suggestionCard__address">{sp.address}</div>}
                        {sp.tag && <span className="suggestionCard__tag">{sp.tag}</span>}
                      </div>
                    </label>
                  )
                })}
              </div>

              <div style={{ marginTop: 14, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <div className="generateTransportSwitch">
                  {([
                    { value: 'auto', label: 'Авто', icon: '🚗' },
                    { value: 'pedestrian', label: 'Пешком', icon: '🚶' },
                    { value: 'bicycle', label: 'Велосипед', icon: '🚲' },
                  ] as const).map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      className={`generateTransportSwitch__btn ${routeMode === opt.value ? 'generateTransportSwitch__btn--active' : ''}`}
                      onClick={() => setRouteMode(opt.value)}
                    >
                      <span>{opt.icon}</span> {opt.label}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className="primaryBtn"
                  disabled={!selectedIds.size || loading}
                  onClick={() => void handleGenerateRoute()}
                >
                  Построить маршрут ({selectedIds.size})
                </button>
              </div>

              {routeEstimate && (
                <div className="routeEstimate">
                  <div className="routeEstimate__item">
                    <span className="routeEstimate__icon">📏</span>
                    <span>{routeEstimate.totalKm.toFixed(1)} км</span>
                  </div>
                  <div className="routeEstimate__item">
                    <span className="routeEstimate__icon">🚏</span>
                    <span>В пути: {formatDuration(routeEstimate.travelMinutes)}</span>
                  </div>
                  <div className="routeEstimate__item">
                    <span className="routeEstimate__icon">📍</span>
                    <span>Осмотр: ~{formatDuration(routeEstimate.visitMinutes)}</span>
                  </div>
                  <div className="routeEstimate__item routeEstimate__item--total">
                    <span className="routeEstimate__icon">⏱️</span>
                    <span>Всего: ~{formatDuration(routeEstimate.totalMinutes)}</span>
                  </div>
                  {routeEstimate.costRub > 0 && (
                    <div className="routeEstimate__item">
                      <span className="routeEstimate__icon">⛽</span>
                      <span>~{routeEstimate.costRub} ₽ на бензин</span>
                    </div>
                  )}
                  {routeMode === 'pedestrian' && (
                    <div className="routeEstimate__item routeEstimate__item--free">
                      <span className="routeEstimate__icon">💚</span>
                      <span>Бесплатно</span>
                    </div>
                  )}
                  {routeMode === 'bicycle' && (
                    <div className="routeEstimate__item routeEstimate__item--free">
                      <span className="routeEstimate__icon">💚</span>
                      <span>Бесплатно</span>
                    </div>
                  )}
                </div>
              )}
            </section>
          )}

          {/* --- Карточки тура (если маршрут готов) --- */}
          {tour && (
            <section className="generatePanel">
              <div className="generatePanel__head">
                <h2 className="generatePanel__title">{tour.title}</h2>
                <p className="generatePanel__desc">{tour.description}</p>
              </div>
              <div className="suggestionsGrid">
                {tour.points.map((p, i) => (
                  <div
                    key={p.id}
                    className="suggestionCard suggestionCard--active suggestionCard--route"
                    onClick={() => { setSelectedPoint(p); setModalOpen(true) }}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="suggestionCard__index">{i + 1}</div>
                    <div className="suggestionCard__body">
                      <div className="suggestionCard__name">{p.name}</div>
                      {p.address && <div className="suggestionCard__address">{p.address}</div>}
                      {p.tags.length > 0 && <span className="suggestionCard__tag">{p.tags[0]}</span>}
                    </div>
                  </div>
                ))}
              </div>
              {routeEstimate && (
                <div className="routeEstimate">
                  <div className="routeEstimate__item">
                    <span className="routeEstimate__icon">📏</span>
                    <span>{routeEstimate.totalKm.toFixed(1)} км</span>
                  </div>
                  <div className="routeEstimate__item">
                    <span className="routeEstimate__icon">🚏</span>
                    <span>В пути: {formatDuration(routeEstimate.travelMinutes)}</span>
                  </div>
                  <div className="routeEstimate__item">
                    <span className="routeEstimate__icon">📍</span>
                    <span>Осмотр: ~{formatDuration(routeEstimate.visitMinutes)}</span>
                  </div>
                  <div className="routeEstimate__item routeEstimate__item--total">
                    <span className="routeEstimate__icon">⏱️</span>
                    <span>Всего: ~{formatDuration(routeEstimate.totalMinutes)}</span>
                  </div>
                  {routeEstimate.costRub > 0 && (
                    <div className="routeEstimate__item">
                      <span className="routeEstimate__icon">⛽</span>
                      <span>~{routeEstimate.costRub} ₽ на бензин</span>
                    </div>
                  )}
                  {routeEstimate.costRub === 0 && (
                    <div className="routeEstimate__item routeEstimate__item--free">
                      <span className="routeEstimate__icon">💚</span>
                      <span>Бесплатно</span>
                    </div>
                  )}
                </div>
              )}
              <div style={{ marginTop: 14, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="primaryBtn"
                  onClick={() => props.onPickRoute(tour.points)}
                >
                  Открыть на карте
                </button>
                <button
                  type="button"
                  className="secondaryBtn"
                  onClick={() => { setTour(null); setPhase('suggestions_ready') }}
                >
                  Перегенерировать
                </button>
              </div>
            </section>
          )}

          {/* --- Пустой placeholder --- */}
          {!suggestions.length && !tour && !loading && (
            <section className="generatePanel">
              <div className="tourCardsEmpty">
                <div className="tourCardsEmpty__icon" aria-hidden>🗺️</div>
                <p className="tourCardsEmpty__title">Пока нет вариантов</p>
                <p className="tourCardsEmpty__text">
                  Опишите поездку в чате — здесь появятся предложенные места и маршрут на карте.
                </p>
              </div>
            </section>
          )}

          {/* --- Карта --- */}
          <section className="generatePanel generatePanel--map">
            <div className="generatePanel__head generatePanel__head--row">
              <div>
                <h2 className="generatePanel__title">
                  {tour ? 'Маршрут по дорогам' : 'Карта'}
                </h2>
                <p className="generatePanel__desc">
                  {tour ? 'Точки можно открыть для подробностей' : 'Предпросмотр выбранных мест'}
                </p>
              </div>
              {tour && (
                <div className="generateTransportSwitch">
                  {([
                    { value: 'auto', label: 'Авто', icon: '🚗' },
                    { value: 'pedestrian', label: 'Пешком', icon: '🚶' },
                    { value: 'bicycle', label: 'Велосипед', icon: '🚲' },
                  ] as const).map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      className={`generateTransportSwitch__btn ${routeMode === opt.value ? 'generateTransportSwitch__btn--active' : ''}`}
                      onClick={() => setRouteMode(opt.value)}
                    >
                      <span>{opt.icon}</span> {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="generateMapShell">
              <TourMap
                tour={previewTour}
                routeMode={routeMode}
                onPickPoint={(p) => { setSelectedPoint(p); setModalOpen(true) }}
              />
            </div>
          </section>
        </div>
      </div>

      <PlaceModal open={modalOpen} point={selectedPoint} onClose={() => setModalOpen(false)} />
    </div>
  )
}

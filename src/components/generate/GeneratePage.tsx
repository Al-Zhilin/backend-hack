import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { AuthProfile } from '../../types'

import ChatInput from './ChatInput'
import PlaceModal from './PlaceModal'
import TourMap from './TourMap'
import type { ChatMessage, FlowPhase, SuggestedPlace, Tour, TourPoint } from './types'
import { enrichTourPoints } from '../../services/enrichment'
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

const POLL_SUGGESTIONS_INTERVAL = 3_000
const POLL_SUGGESTIONS_MAX = 60
const POLL_ROUTE_INTERVAL = 2_000
const POLL_ROUTE_MAX = 45

export default function GeneratePage(props: { profile: AuthProfile; onPickRoute: (placeIds: string[]) => void }) {
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
  const [transportMode, setTransportMode] = useState<string>('auto')

  const [tour, setTour] = useState<Tour | null>(null)
  const [selectedPoint, setSelectedPoint] = useState<TourPoint | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [routeMode, setRouteMode] = useState<'auto' | 'pedestrian'>('auto')

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
        const raw = await res.text()
        let data: any
        try { data = JSON.parse(raw) } catch { data = { message: raw } }

        if (data.message && typeof data.message === 'string' &&
          (data.message.includes('подбираются') || data.message.includes('ожидании'))) {
          await new Promise(r => setTimeout(r, POLL_SUGGESTIONS_INTERVAL))
          continue
        }

        let places: SuggestedPlace[] = []
        if (Array.isArray(data)) places = data
        else if (Array.isArray(data.places)) places = data.places
        else if (Array.isArray(data.suggested_places)) places = data.suggested_places

        if (places.length > 0) {
          setSuggestions(places)
          setSelectedIds(new Set(places.map(p => p.id)))
          if (data.transport_mode) setTransportMode(data.transport_mode)
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
        const raw = await res.text()
        let data: any
        try { data = JSON.parse(raw) } catch { data = { message: raw } }

        if (data.message && typeof data.message === 'string' &&
          (data.message.includes('не найден') || data.message.includes('генерируется') || data.message.includes('ожидании'))) {
          await new Promise(r => setTimeout(r, POLL_ROUTE_INTERVAL))
          continue
        }

        let rawPoints: any[] = []
        if (Array.isArray(data.points)) rawPoints = data.points
        else if (Array.isArray(data.route)) rawPoints = data.route
        else if (Array.isArray(data)) rawPoints = data

        const points: TourPoint[] = rawPoints.map((p: any) => ({
          id: p.id || makeId('p'),
          name: p.name || 'Точка',
          address: p.address || '',
          lat: p.lat,
          lng: p.lon ?? p.lng,
          description: p.description || '',
          tags: p.tag ? [p.tag] : (p.tags || []),
        }))

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
          }
          setTour(newTour)
          setPhase('route_ready')
          props.onPickRoute(enriched.map(p => p.id))
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

      setPhase('polling_suggestions')
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

    const selected = suggestions.filter(p => selectedIds.has(p.id))
    const start = selected[0]

    try {
      const res = await fetch(`${API_BASE}/api/generate_route`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          login,
          transport_mode: transportMode,
          start_point: { name: start.name, lat: start.lat, lon: start.lon },
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
                <button
                  type="button"
                  className="primaryBtn"
                  disabled={!selectedIds.size || loading}
                  onClick={() => void handleGenerateRoute()}
                >
                  Построить маршрут ({selectedIds.size})
                </button>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                  <span style={{ fontWeight: 700, opacity: 0.7 }}>Транспорт:</span>
                  <select
                    className="generateRouteSelect__control"
                    value={transportMode}
                    onChange={(e) => setTransportMode(e.target.value)}
                  >
                    <option value="auto">На машине</option>
                    <option value="pedestrian">Пешком</option>
                    <option value="public">Общественный</option>
                  </select>
                </label>
              </div>
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
                <label className="generateRouteSelect">
                  <span className="generateRouteSelect__label">Режим</span>
                  <select
                    className="generateRouteSelect__control"
                    value={routeMode}
                    onChange={(e) => setRouteMode(e.target.value as 'auto' | 'pedestrian')}
                  >
                    <option value="auto">На машине</option>
                    <option value="pedestrian">Пешком</option>
                  </select>
                </label>
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

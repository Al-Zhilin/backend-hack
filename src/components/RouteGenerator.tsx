import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Map as YMap, Panorama, Placemark, TrafficControl, YMaps } from '@pbe/react-yandex-maps'

import type { AuthProfile } from '../types'
import { YANDEX_MAPS_QUERY } from '../config/yandex'

type ChatMessage = { id: string; role: 'user' | 'assistant'; text: string }

type BackendTourPoint = {
  id: string
  name: string
  address: string
  lat: number
  lng: number
  description: string
  tags: string[]
}

type BackendTour = {
  id: string
  title: string
  duration: number
  description: string
  price: string
  points: BackendTourPoint[]
}

type BackendResponse = {
  tours: BackendTour[]
}

const GENERATE_ENDPOINT = 'https://backend-hack-05iw.onrender.com/'

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}_${Date.now()}`
}

export default function RouteGenerator(props: { profile: AuthProfile; onPickRoute: (placeIds: string[]) => void }) {
  const interests = props.profile.interests
  if (!interests) return null

  const [prompt, setPrompt] = useState('')
  const [lastPrompt, setLastPrompt] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: uid('m'),
      role: 'assistant',
      text: 'Опишите поездку естественным языком. Пример: "семья с детьми, активный отдых на 3 дня, бюджет до 50к".',
    },
  ])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [tours, setTours] = useState<BackendTour[]>([])
  const [selectedTourId, setSelectedTourId] = useState<string | null>(null)
  const [selectedPoint, setSelectedPoint] = useState<BackendTourPoint | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [panoramaTry, setPanoramaTry] = useState(0)
  const [panoramaFailed, setPanoramaFailed] = useState(false)

  const mapInstanceRef = useRef<any>(null)
  const routeRef = useRef<any>(null)

  const selectedTour = useMemo(() => tours.find((t) => t.id === selectedTourId) ?? null, [tours, selectedTourId])
  const routePoints = selectedTour?.points ?? []

  const sendPrompt = async (text: string) => {
    const clean = text.trim()
    if (!clean || isLoading) return

    setError(null)
    setIsLoading(true)
    setLastPrompt(clean)
    setMessages((prev) => [
      ...prev,
      { id: uid('m'), role: 'user', text: clean },
      { id: uid('m'), role: 'assistant', text: 'Генерирую варианты...' },
    ])

    try {
      const payload = {
        query: clean,
        context: {
          interests,
          season: interests.season,
        },
      }
      const res = await fetch(GENERATE_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        throw new Error(`Ошибка API: ${res.status}`)
      }

      const data = (await res.json()) as BackendResponse
      const nextTours = Array.isArray(data?.tours) ? data.tours : []
      setTours(nextTours)

      setMessages((prev) => {
        const withoutLoading = prev.filter((m) => m.text !== 'Генерирую варианты...')
        return [
          ...withoutLoading,
          {
            id: uid('m'),
            role: 'assistant',
            text: nextTours.length
              ? `Готово: нашёл ${nextTours.length} вариантов. Выберите карточку тура для построения маршрута.`
              : 'Варианты не найдены. Попробуйте уточнить запрос.',
          },
        ]
      })

      if (nextTours[0]) {
        setSelectedTourId(nextTours[0].id)
      }
    } catch (e) {
      setError((e as Error).message)
      setMessages((prev) => {
        const withoutLoading = prev.filter((m) => m.text !== 'Генерирую варианты...')
        return [...withoutLoading, { id: uid('m'), role: 'assistant', text: 'Не удалось получить варианты. Попробуйте ещё раз.' }]
      })
    } finally {
      setIsLoading(false)
      setPrompt('')
    }
  }

  const onSubmit = async () => {
    await sendPrompt(prompt)
  }

  const ensureMapRoute = (ymapsApi: any) => {
    const map = mapInstanceRef.current
    if (!map || !selectedTour || selectedTour.points.length < 2 || !ymapsApi?.multiRouter) return

    // Удаляем предыдущий маршрут перед построением нового.
    if (routeRef.current) {
      map.geoObjects.remove(routeRef.current)
      routeRef.current = null
    }

    const points = selectedTour.points.map((p) => [p.lat, p.lng])
    const multiRoute = new ymapsApi.multiRouter.MultiRoute(
      {
        referencePoints: points,
        params: { routingMode: 'auto', avoidTrafficJams: false },
      },
      {
        boundsAutoApply: true,
        wayPointStartIconColor: '#16a34a',
        wayPointFinishIconColor: '#facc15',
      },
    )

    map.geoObjects.add(multiRoute)
    routeRef.current = multiRoute
  }

  useEffect(() => {
    // При смене тура сбрасываем состояние панорамы.
    setPanoramaTry((n) => n + 1)
    setPanoramaFailed(false)
  }, [selectedTourId, selectedPoint?.id])

  return (
    <div className="page">
      <h2>Сгенерировать тур</h2>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 440px) 1fr', gap: 14, marginTop: 14 }}>
        {/* ЧАТ */}
        <section className="card" style={{ padding: 14, minHeight: 540, display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontWeight: 900 }}>AI-чат планировщика</div>
          <div style={{ opacity: 0.75, marginTop: 6 }}>Запрос на русском языке → варианты туров от LLM.</div>

          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8, overflow: 'auto', flex: 1 }}>
            {messages.map((msg) => (
              <div
                key={msg.id}
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: 12,
                  padding: '8px 10px',
                  background: msg.role === 'user' ? 'rgba(22,163,74,0.12)' : 'rgba(255,255,255,0.8)',
                  alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '92%',
                }}
              >
                {msg.text}
              </div>
            ))}
          </div>

          <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
            <input
              className="input"
              style={{ flex: 1 }}
              placeholder='Например: "активный семейный тур на 3 дня с природой и эко-фермой"'
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void onSubmit()
                }
              }}
            />
            <button type="button" className="primaryBtn" disabled={isLoading || !prompt.trim()} onClick={() => void onSubmit()}>
              Отправить
            </button>
          </div>
          {error && <div style={{ color: '#b91c1c', marginTop: 8, fontWeight: 700 }}>{error}</div>}
          <button
            type="button"
            className="secondaryBtn"
            style={{ marginTop: 8 }}
            disabled={isLoading || !lastPrompt}
            onClick={() => void sendPrompt(lastPrompt)}
          >
            Сгенерировать ещё варианты
          </button>
        </section>

        {/* КАРТОЧКИ ТУРОВ + КАРТА */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="card" style={{ padding: 12 }}>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {tours.map((tour) => {
                const active = selectedTourId === tour.id
                return (
                  <div
                    key={tour.id}
                    style={{
                      border: active ? '1px solid rgba(22,163,74,0.65)' : '1px solid var(--border)',
                      borderRadius: 14,
                      padding: 10,
                      minWidth: 220,
                      flex: '1 1 220px',
                      background: active ? 'rgba(22,163,74,0.1)' : 'rgba(255,255,255,0.86)',
                    }}
                  >
                    <div style={{ fontWeight: 900 }}>{tour.title}</div>
                    <div style={{ opacity: 0.75, marginTop: 4 }}>
                      {tour.duration} дня • {tour.price}
                    </div>
                    <div style={{ opacity: 0.86, marginTop: 6, lineHeight: 1.25 }}>{tour.description}</div>
                    <button
                      type="button"
                      className="primaryBtn"
                      style={{ marginTop: 8 }}
                      onClick={() => {
                        setSelectedTourId(tour.id)
                        props.onPickRoute(tour.points.map((p) => p.id))
                      }}
                    >
                      Посмотреть маршрут
                    </button>
                  </div>
                )
              })}
              {!tours.length && <div style={{ opacity: 0.72 }}>После генерации здесь появятся 3–5 карточек туров.</div>}
            </div>
          </div>

          <div className="card" style={{ padding: 10 }}>
            <div style={{ fontWeight: 900, marginBottom: 8 }}>Интерактивная карта маршрута</div>
            <div style={{ height: 520, borderRadius: 14, overflow: 'hidden', border: '1px solid var(--border)' }}>
              <YMaps query={YANDEX_MAPS_QUERY} preload>
                <YMap
                  defaultState={{ center: [44.8, 38.5], zoom: 8 }}
                  width="100%"
                  height="100%"
                  instanceRef={(map: any) => {
                    mapInstanceRef.current = map
                  }}
                  onLoad={(ymapsApi: any) => ensureMapRoute(ymapsApi)}
                  options={{ suppressMapOpenBlock: true }}
                >
                  <TrafficControl />
                  {routePoints.map((p) => (
                    <Placemark
                      key={p.id}
                      geometry={[p.lat, p.lng]}
                      options={{ preset: 'islands#greenDotIcon' }}
                      properties={{
                        balloonContentHeader: p.name,
                        balloonContentBody: `${p.address}<br/><a href="https://yandex.ru/maps/?pt=${p.lng},${p.lat}&z=14&l=map" target="_blank" rel="noreferrer">Открыть на Яндекс.Картах</a>`,
                      }}
                      instanceRef={(inst: any) => {
                        if (!inst || inst.__clickAttached) return
                        inst.__clickAttached = true
                        inst.events?.add?.('click', () => {
                          setSelectedPoint(p)
                          setModalOpen(true)
                        })
                      }}
                    />
                  ))}
                </YMap>
              </YMaps>
            </div>
          </div>
        </section>
      </div>

      {/* Модальное окно точки маршрута */}
      <AnimatePresence>
        {modalOpen && selectedPoint && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setModalOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 90,
              background: 'rgba(0,0,0,0.55)',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              padding: 12,
            }}
          >
            <motion.div
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 10, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                width: 'min(980px, 100%)',
                background: '#fff',
                borderRadius: 18,
                border: '1px solid var(--border)',
                padding: 14,
                maxHeight: '90vh',
                overflow: 'auto',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <div>
                  <div style={{ fontWeight: 900, fontSize: 20 }}>{selectedPoint.name}</div>
                  <div style={{ opacity: 0.78, marginTop: 4 }}>{selectedPoint.address}</div>
                </div>
                <button type="button" className="secondaryBtn" onClick={() => setModalOpen(false)}>
                  Закрыть
                </button>
              </div>

              <div style={{ marginTop: 12, lineHeight: 1.4 }}>{selectedPoint.description}</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                {selectedPoint.tags.map((tag) => (
                  <span key={tag} className="chip active">
                    {tag}
                  </span>
                ))}
              </div>

              <div style={{ marginTop: 12, border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
                {!panoramaFailed ? (
                  <YMaps query={YANDEX_MAPS_QUERY} preload>
                    <Panorama
                      key={`${selectedPoint.id}_${panoramaTry}`}
                      defaultPoint={[selectedPoint.lat, selectedPoint.lng]}
                      width="100%"
                      height={360}
                      onError={() => setPanoramaFailed(true)}
                    />
                  </YMaps>
                ) : (
                  <div style={{ padding: 14 }}>
                    <div style={{ fontWeight: 800 }}>Панорама не найдена рядом с точкой</div>
                    <a
                      href={`https://yandex.ru/maps/?pt=${selectedPoint.lng},${selectedPoint.lat}&z=14&l=map`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ marginTop: 8, display: 'inline-block' }}
                    >
                      Открыть на Яндекс.Картах
                    </a>
                  </div>
                )}
              </div>

              <div style={{ marginTop: 12, opacity: 0.85 }}>
                <div style={{ fontWeight: 850 }}>Отзывы (MVP mock)</div>
                <ul style={{ marginTop: 8, paddingLeft: 18 }}>
                  <li>4.8/5 — "Очень атмосферно и удобно с детьми"</li>
                  <li>4.7/5 — "Хорошая логистика, отличные виды"</li>
                  <li>4.6/5 — "Хочется вернуться в следующий сезон"</li>
                </ul>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}


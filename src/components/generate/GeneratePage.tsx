import { useMemo, useState } from 'react'
import type { AuthProfile } from '../../types'

import ChatInput from './ChatInput'
import PlaceModal from './PlaceModal'
import TourCards from './TourCards'
import TourMap from './TourMap'
import type { ChatMessage, GenerateResponse, Tour, TourPoint } from './types'
import '../../styles/generate.scss'

const API_BASE = 'https://backend-hack-05iw.onrender.com'
const ENDPOINTS_TO_TRY = ['/', '/generate', '/tour', '/chat']

function makeId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}_${Date.now()}`
}

async function tryGenerate(prompt: string): Promise<GenerateResponse> {
  const body = JSON.stringify({ prompt })
  let lastError: unknown = null

  // По ТЗ: сначала пробуем корневой `/`, затем fallback маршруты.
  for (const endpoint of ENDPOINTS_TO_TRY) {
    const url = `${API_BASE}${endpoint}`
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      })
      if (!res.ok) {
        lastError = new Error(`HTTP ${res.status} (${endpoint})`)
        // Пробуем следующий endpoint.
        continue
      }

      const json = (await res.json()) as GenerateResponse
      if (!Array.isArray(json?.tours)) {
        lastError = new Error(`Invalid JSON format from ${endpoint}`)
        continue
      }
      return json
    } catch (e) {
      // Логируем в консоль по требованию.
      // eslint-disable-next-line no-console
      console.error('[generate] endpoint failed:', endpoint, e)
      lastError = e
    }
  }

  throw lastError ?? new Error('No working generate endpoint found')
}

export default function GeneratePage(props: { profile: AuthProfile; onPickRoute: (placeIds: string[]) => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: makeId('m'),
      role: 'assistant',
      text: 'Опишите поездку: длительность, формат отдыха, кто едет, бюджет и пожелания.',
    },
  ])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tours, setTours] = useState<Tour[]>([])
  const [selectedTourId, setSelectedTourId] = useState<string | null>(null)
  const [selectedPoint, setSelectedPoint] = useState<TourPoint | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [lastPrompt, setLastPrompt] = useState<string>('')
  const [routeMode, setRouteMode] = useState<'auto' | 'pedestrian'>('auto')

  const selectedTour = useMemo(() => tours.find((t) => t.id === selectedTourId) ?? null, [tours, selectedTourId])

  const sendPrompt = async (prompt: string) => {
    setError(null)
    setLoading(true)
    setLastPrompt(prompt)

    setMessages((prev) => [
      ...prev,
      { id: makeId('m'), role: 'user', text: prompt },
      { id: makeId('m'), role: 'assistant', text: 'Генерирую варианты...' },
    ])

    try {
      const data = await tryGenerate(prompt)
      setTours(data.tours)
      setSelectedTourId(data.tours[0]?.id ?? null)

      setMessages((prev) => {
        const next = prev.filter((m) => m.text !== 'Генерирую варианты...')
        return [
          ...next,
          {
            id: makeId('m'),
            role: 'assistant',
            text: data.tours.length
              ? `Готово: найдено ${data.tours.length} вариантов. Выберите подходящий тур.`
              : 'Варианты не найдены, попробуйте уточнить запрос.',
          },
        ]
      })
    } catch (e) {
      const message = (e as Error).message || 'Сервис генерации недоступен'
      setError(`Ошибка генерации: ${message}`)
      setMessages((prev) => {
        const next = prev.filter((m) => m.text !== 'Генерирую варианты...')
        return [...next, { id: makeId('m'), role: 'assistant', text: 'Сервис временно недоступен. Попробуйте еще раз.' }]
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page">
      <h2>Сгенерировать тур</h2>

      <div className="generateLayout">
        <section className="card" style={{ padding: 12, display: 'flex', flexDirection: 'column', minHeight: 620 }}>
          <div style={{ fontWeight: 900 }}>Чат с нейросетью</div>
          <div style={{ opacity: 0.75, marginTop: 4 }}>
            Пишите естественным языком: семья, длительность, интересы, бюджет.
          </div>

          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8, overflow: 'auto', flex: 1 }}>
            {messages.map((m) => (
              <div
                key={m.id}
                style={{
                  alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '90%',
                  border: '1px solid var(--border)',
                  borderRadius: 12,
                  padding: '8px 10px',
                  background: m.role === 'user' ? 'rgba(22,163,74,0.12)' : 'rgba(255,255,255,0.85)',
                }}
              >
                {m.text}
              </div>
            ))}
          </div>

          <div style={{ marginTop: 10 }}>
            <ChatInput loading={loading} onSend={sendPrompt} />
            {error && <div style={{ marginTop: 8, color: '#b91c1c', fontWeight: 700 }}>{error}</div>}
            <button
              type="button"
              className="secondaryBtn"
              style={{ marginTop: 8 }}
              disabled={!lastPrompt || loading}
              onClick={() => void sendPrompt(lastPrompt)}
            >
              Сгенерировать еще
            </button>
          </div>
        </section>

        <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <section className="card" style={{ padding: 10 }}>
            <TourCards
              tours={tours}
              selectedTourId={selectedTourId}
              onSelect={(tour) => {
                setSelectedTourId(tour.id)
                props.onPickRoute(tour.points.map((p) => p.id))
              }}
            />
          </section>

          <section className="card" style={{ padding: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontWeight: 900 }}>Реалистичный маршрут по дорогам</div>
              <label className="field" style={{ width: 180 }}>
                <select className="input" value={routeMode} onChange={(e) => setRouteMode(e.target.value as 'auto' | 'pedestrian')}>
                  <option value="auto">Режим: car</option>
                  <option value="pedestrian">Режим: pedestrian</option>
                </select>
              </label>
            </div>

            <TourMap
              tour={selectedTour}
              routeMode={routeMode}
              onPickPoint={(p) => {
                setSelectedPoint(p)
                setModalOpen(true)
              }}
            />
          </section>
        </section>
      </div>

      <PlaceModal open={modalOpen} point={selectedPoint} onClose={() => setModalOpen(false)} />
    </div>
  )
}


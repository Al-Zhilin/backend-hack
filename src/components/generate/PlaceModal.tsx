import { AnimatePresence, motion } from 'framer-motion'
import { Panorama, YMaps } from '@pbe/react-yandex-maps'
import { useState } from 'react'
import type { TourPoint } from './types'
import { YANDEX_MAPS_QUERY } from '../../config/yandex'

export default function PlaceModal(props: {
  open: boolean
  point: TourPoint | null
  onClose: () => void
}) {
  const [panoramaError, setPanoramaError] = useState(false)

  return (
    <AnimatePresence>
      {props.open && props.point && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={props.onClose}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            background: 'rgba(0,0,0,0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 12,
          }}
        >
          <motion.div
            initial={{ y: 12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 12, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="card"
            style={{
              width: 'min(980px, 100%)',
              maxHeight: '90vh',
              overflow: 'auto',
              padding: 14,
              background: 'rgba(255,255,255,0.98)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
              <div>
                <div style={{ fontWeight: 1000, fontSize: 20 }}>{props.point.name}</div>
                <div style={{ opacity: 0.75, marginTop: 4 }}>{props.point.address}</div>
              </div>
              <button type="button" className="secondaryBtn" onClick={props.onClose}>
                Закрыть
              </button>
            </div>

            <div style={{ marginTop: 12, lineHeight: 1.4 }}>{props.point.description}</div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
              {props.point.tags.map((t) => (
                <span key={t} className="chip active">
                  {t}
                </span>
              ))}
            </div>

            <div style={{ marginTop: 12, border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
              {!panoramaError ? (
                <YMaps query={YANDEX_MAPS_QUERY}>
                  <Panorama
                    defaultPoint={[props.point.lat, props.point.lng]}
                    width="100%"
                    height={400}
                    onError={() => setPanoramaError(true)}
                  />
                </YMaps>
              ) : (
                <div style={{ padding: 16 }}>
                  <div style={{ fontWeight: 850 }}>Панорама недоступна</div>
                  <div style={{ opacity: 0.8, marginTop: 8 }}>Для этой точки 360° панорама не найдена рядом с координатой.</div>
                  {props.point.photoUrl && (
                    <img
                      src={props.point.photoUrl}
                      alt={`Фото: ${props.point.name}`}
                      style={{ width: '100%', height: 160, objectFit: 'cover', borderRadius: 12, marginTop: 12, border: '1px solid rgba(0,0,0,0.08)' }}
                    />
                  )}
                </div>
              )}
            </div>

            <div style={{ marginTop: 12 }}>
              <div style={{ fontWeight: 850 }}>Информация и отзывы (MVP)</div>
              <div style={{ marginTop: 6, opacity: 0.85 }}>Рейтинг: 4.7 / 5</div>
              <ul style={{ marginTop: 6, paddingLeft: 18, opacity: 0.85 }}>
                <li>Очень красивое место, рекомендую приезжать утром.</li>
                <li>Удобно для семьи, есть где пообедать и погулять.</li>
                <li>Хорошая точка для старта дневного маршрута.</li>
              </ul>
              <a
                href={`https://yandex.ru/maps/?pt=${props.point.lng},${props.point.lat}&z=14&l=map`}
                target="_blank"
                rel="noreferrer"
              >
                Открыть на Яндекс.Картах
              </a>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}


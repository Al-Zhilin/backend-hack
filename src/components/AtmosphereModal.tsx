import { AnimatePresence, motion } from 'framer-motion'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import type { Location } from '../data/locations'

function useIsMobile() {
  // MVP: простая проверка ширины окна.
  // (В настоящем проде лучше использовать matchMedia + слушатели.)
  const [isMobile] = useState(() => (typeof window !== 'undefined' ? window.innerWidth < 768 : false))
  return isMobile
}

function PhotoStrip(props: { photos: string[] }) {
  if (props.photos.length === 0) return null
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
      {props.photos.slice(0, 6).map((src, idx) => (
        <div
          // eslint-disable-next-line react/no-array-index-key
          key={idx}
          style={{
            borderRadius: 12,
            overflow: 'hidden',
            border: '1px solid rgba(255,255,255,0.08)',
            background: 'rgba(255,255,255,0.02)',
          }}
        >
          <img src={src} alt={`Фото ${idx + 1}`} style={{ width: '100%', height: 90, objectFit: 'cover', display: 'block' }} />
        </div>
      ))}
    </div>
  )
}

export default function AtmosphereModal(props: {
  open: boolean
  place: Location | null
  onClose: () => void
}) {
  const { open, place } = props
  const navigate = useNavigate()
  const isMobile = useIsMobile()

  const photos = useMemo(() => {
    if (!place) return []
    return place.photos?.length ? place.photos : [place.photoUrl]
  }, [place])

  const aiStory = useMemo(() => {
    if (!place) return ''
    return place.aiFullDescription ?? place.description
  }, [place])

  return (
    <AnimatePresence>
      {open && place && (
        <motion.div
          className="modalOverlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 80,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 12,
          }}
          onClick={props.onClose}
        >
          <motion.div
            onClick={(e) => e.stopPropagation()}
            initial={{ scale: 0.98, y: 10, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.98, y: 10, opacity: 0 }}
            transition={{ duration: 0.18 }}
            style={{
              width: 'min(980px, 100%)',
              maxHeight: '86vh',
              overflow: 'auto',
              borderRadius: 18,
              background: 'rgba(20, 22, 35, 0.98)',
              border: '1px solid var(--border)',
              boxShadow: '0 40px 120px rgba(0,0,0,0.55)',
              padding: 14,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
              <div>
                <div style={{ fontWeight: 1000, fontSize: 20 }}>Выберите способ погружения</div>
                <div style={{ opacity: 0.8, marginTop: 6 }}>Место: {place.name}</div>
              </div>

              <button className="iconBtn" type="button" onClick={props.onClose}>
                Закрыть
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12, marginTop: 14 }}>
              {/* Option 1: VR / fullscreen 360 */}
              <div
                style={{
                  borderRadius: 16,
                  border: '1px solid rgba(255,255,255,0.12)',
                  background: 'rgba(255,255,255,0.02)',
                  padding: 14,
                }}
              >
                <div style={{ fontWeight: 950, fontSize: 16 }}>1) Виртуальная реальность на устройстве</div>
                <div style={{ opacity: 0.82, marginTop: 8, lineHeight: 1.35 }}>
                  Погружение с WebXR/VR. Для MVP используем `360_photo_url` (если доступен).
                </div>

                <div style={{ marginTop: 12, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {place.vr_enabled ? (
                    <button
                      type="button"
                      className={isMobile ? 'primaryBtn' : 'secondaryBtn'}
                      style={{ flex: '1 1 220px' }}
                      onClick={() =>
                        navigate(isMobile ? `/vr?placeId=${encodeURIComponent(place.id)}` : `/pano?placeId=${encodeURIComponent(place.id)}`)
                      }
                      disabled={!place.vr_enabled}
                      aria-disabled={!place.vr_enabled}
                    >
                      {isMobile ? 'Открыть в VR-режиме' : 'Открыть в полноэкранном 360° режиме'}
                    </button>
                  ) : (
                    <div style={{ opacity: 0.75, fontWeight: 700 }}>
                      360/VR-панорама для этой локации пока не включена.
                    </div>
                  )}
                </div>
              </div>

              {/* Option 2: Normal viewing */}
              <div
                style={{
                  borderRadius: 16,
                  border: '1px solid rgba(255,255,255,0.12)',
                  background: 'rgba(255,255,255,0.02)',
                  padding: 14,
                }}
              >
                <div style={{ fontWeight: 950, fontSize: 16 }}>2) Обычный просмотр</div>
                <div style={{ opacity: 0.82, marginTop: 8, lineHeight: 1.35 }}>
                  Галерея + видео (360) и AI-рассказ гида — прямо в модалке.
                </div>

                <div style={{ marginTop: 12 }}>
                  <PhotoStrip photos={photos} />
                </div>

                {place.youtube360_url && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontWeight: 850, opacity: 0.9, marginBottom: 8 }}>Видео 360°</div>
                    <div
                      style={{
                        borderRadius: 14,
                        overflow: 'hidden',
                        border: '1px solid rgba(255,255,255,0.10)',
                        background: 'rgba(0,0,0,0.25)',
                      }}
                    >
                      <iframe
                        title="YouTube 360"
                        src={place.youtube360_url}
                        width="100%"
                        height="240"
                        allow="autoplay; encrypted-media; picture-in-picture"
                        style={{ border: 0, display: 'block' }}
                        referrerPolicy="strict-origin-when-cross-origin"
                        allowFullScreen
                      />
                    </div>
                  </div>
                )}

                <div style={{ marginTop: 12, opacity: 0.9, lineHeight: 1.35, fontWeight: 650 }}>
                  {aiStory.length > 260 ? aiStory.slice(0, 260) + '…' : aiStory}
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}


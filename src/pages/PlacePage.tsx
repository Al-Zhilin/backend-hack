import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { AuthProfile } from '../types'

import { LOCATIONS } from '../data/locations'
import type { Location } from '../data/locations'
import AtmosphereModal from '../components/AtmosphereModal'
import PlaceFullWidthHero from '../components/PlaceFullWidthHero'
import { getMatchedTagChipIds, TAG_CHIPS } from '../utils/tagChips'
import { locationToCardProps, PlaceReviewsBlock } from '../components/PlaceCard'
import '../styles/place-card.scss'

function getPhotos(place: Location) {
  const base = place.photos?.length ? place.photos : [place.photoUrl]
  if (base.length >= 5) return base
  return Array.from({ length: 6 }, (_, i) => base[i % base.length]!)
}

function formatList(list: string[] | undefined) {
  if (!list?.length) return '—'
  return list.map((x) => `• ${x}`).join('\n')
}

const SEASON_LABELS: Record<string, string> = {
  spring: 'Весна',
  summer: 'Лето',
  autumn: 'Осень',
  winter: 'Зима',
}

export default function PlacePage(props: { profile: AuthProfile | null }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const [modalOpen, setModalOpen] = useState(false)

  const place = useMemo(() => {
    if (!id) return null
    return LOCATIONS.find((l) => l.id === id) ?? null
  }, [id])

  const photos = useMemo(() => (place ? getPhotos(place) : []), [place])

  const matchedTagIds = useMemo(() => {
    if (!place || !props.profile?.interests) return []
    return getMatchedTagChipIds(place, props.profile.interests)
  }, [place, props.profile?.interests])

  const matchedTags = useMemo(() => {
    const set = new Set(matchedTagIds)
    return TAG_CHIPS.filter((t) => set.has(t.id))
  }, [matchedTagIds])

  const cardProps = useMemo(() => {
    if (!place) return null
    return locationToCardProps(place)
  }, [place])

  const aiFullDescription = useMemo(() => {
    if (!place) return ''
    return (
      place.aiFullDescription ??
      [
        place.description,
        'AI-гид: Мы советуем начать с ключевой точки, затем перейти к более "медленным" впечатлениям и закончить дегустацией/прогулкой в комфортном темпе.',
        'Под вашу компанию это место легко вписывается в маршрут благодаря погоде, сезонности и мягкой логистике.',
      ].join(' ')
    )
  }, [place])

  if (!place || !cardProps) {
    return (
      <div className="page">
        <h2>Место не найдено</h2>
        <button type="button" className="primaryBtn" onClick={() => navigate('/map')}>
          Вернуться к карте
        </button>
      </div>
    )
  }

  return (
    <>
      <div style={{ padding: 22, maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <button type="button" className="secondaryBtn" onClick={() => navigate('/map')}>
            Назад
          </button>
          <button type="button" className="accentBtn" onClick={() => setModalOpen(true)}>
            Окунуться в атмосферу
          </button>
        </div>

        <div style={{ marginTop: 14 }}>
          <PlaceFullWidthHero image={photos[0] ?? place.photoUrl} title={place.name} subtitle={matchedTags.map((t) => t.label).join(' • ')} />
        </div>

        <div style={{ marginTop: 18, display: 'grid', gridTemplateColumns: '1fr', gap: 16 }}>
          <section
            style={{
              borderRadius: 18,
              border: '1px solid var(--border)',
              background: 'rgba(255,255,255,0.85)',
              padding: 16,
            }}
          >
            <h2 style={{ margin: 0, fontSize: 20 }}>AI-описание</h2>
            <p style={{ marginTop: 10, opacity: 0.92, lineHeight: 1.5 }}>{aiFullDescription}</p>

            {(matchedTags.length > 0 || cardProps.tags.length > 0) && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontWeight: 900, opacity: 0.85, marginBottom: 8 }}>Теги</div>
                <div className="placeCardTags">
                  {matchedTags.map((t) => (
                    <span key={t.id} className="placeCardTag placeCardTag--tour">
                      {t.label}
                    </span>
                  ))}
                  {cardProps.tags.map((t) => (
                    <span key={t} className="placeCardTag placeCardTag--place">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </section>

          <section
            style={{
              borderRadius: 18,
              border: '1px solid var(--border)',
              background: 'rgba(255,255,255,0.85)',
              padding: 16,
            }}
          >
            <PlaceReviewsBlock placeId={place.id} />
          </section>

          <section
            style={{
              borderRadius: 18,
              border: '1px solid var(--border)',
              background: 'rgba(255,255,255,0.85)',
              padding: 16,
            }}
          >
            <h3 style={{ margin: 0, fontSize: 18 }}>Практика и сервис</h3>
            <div style={{ marginTop: 12, opacity: 0.9, lineHeight: 1.5 }}>
              <div>
                <b>Адрес:</b> {cardProps.address ?? 'Адрес уточняется.'}
              </div>
              <div>
                <b>Как добраться:</b> {place.howToGet ?? 'Подъедем по маршруту.'}
              </div>
              <div style={{ marginTop: 10 }}>
                <b>Часы работы:</b> {cardProps.workingHours ?? 'Ежедневно'}
              </div>
              <div style={{ marginTop: 8 }}>
                <b>Телефон:</b>{' '}
                {cardProps.phone ? (
                  <a href={`tel:${cardProps.phone}`}>{cardProps.phone}</a>
                ) : (
                  'Уточняется'
                )}
              </div>
              {cardProps.website && (
                <div style={{ marginTop: 8 }}>
                  <b>Сайт:</b>{' '}
                  <a href={cardProps.website.startsWith('http') ? cardProps.website : `https://${cardProps.website}`} target="_blank" rel="noreferrer">
                    {cardProps.website}
                  </a>
                </div>
              )}
              <div style={{ marginTop: 8 }}>
                <b>Цены:</b> {cardProps.prices ?? 'Стоимость зависит от формата.'}
              </div>
            </div>
          </section>

          <section
            style={{
              borderRadius: 18,
              border: '1px solid var(--border)',
              background: 'rgba(255,255,255,0.85)',
              padding: 16,
            }}
          >
            <h3 style={{ margin: 0, fontSize: 18 }}>Сезонность и рекомендации</h3>
            <div style={{ marginTop: 12, opacity: 0.9, lineHeight: 1.6 }}>
              <b>Сезонность:</b>
              <div className="placeCardSeasons" style={{ marginTop: 6, marginBottom: 10 }}>
                {(cardProps.seasonality ?? place.seasons).map((s) => (
                  <span key={s} className="placeCardSeason">
                    {SEASON_LABELS[s] ?? s}
                  </span>
                ))}
              </div>
              <div style={{ whiteSpace: 'pre-wrap' }}>
                <b>Рекомендации:</b> {formatList(place.recommendations)}
              </div>
            </div>
          </section>
        </div>
      </div>

      <AtmosphereModal open={modalOpen} place={place} onClose={() => setModalOpen(false)} />
    </>
  )
}

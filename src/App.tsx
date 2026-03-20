import { useMemo, useState } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'

import type { AuthProfile } from './types'
import { clearProfile, loadProfile, loadTrips } from './utils/storage'

import AuthPage from './components/AuthPage'
import InteractiveMap from './components/InteractiveMap'
import Profile from './components/Profile'
import VRView from './components/VRView'
import RouteGenerator from './components/RouteGenerator'
import Pano360View from './components/Pano360View'
import TripsPage from './pages/TripsPage'
import PlacePage from './pages/PlacePage'

import './styles/layout.scss'

function SidebarItem(props: {
  label: string
  to: string
  onNavigate?: () => void
  active?: boolean
  disabled?: boolean
}) {
  const navigate = useNavigate()
  const { label, to, active, disabled, onNavigate } = props

  return (
    <button
      type="button"
      className={`navItem ${active ? 'active' : ''}`}
      disabled={disabled}
      onClick={() => {
        navigate(to)
        onNavigate?.()
      }}
    >
      {label}
    </button>
  )
}

function getActivePathname(pathname: string) {
  if (pathname.startsWith('/trips')) return '/trips'
  if (pathname.startsWith('/recommendations')) return '/recommendations'
  if (pathname.startsWith('/partner')) return '/partner'
  return pathname
}

export default function App() {
  const navigate = useNavigate()
  const location = useLocation()

  const [profile, setProfile] = useState<AuthProfile | null>(() => loadProfile())
  const [trips] = useState(() => loadTrips())

  const [drawerOpen, setDrawerOpen] = useState(false)

  const activePath = getActivePathname(location.pathname)

  const onLogout = () => {
    clearProfile()
    setProfile(null)
    navigate('/')
  }

  const content = useMemo(() => {
    if (!profile) {
      return (
        <Routes>
          <Route path="/" element={<AuthPage onDone={(p) => setProfile(p)} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      )
    }

    const role = profile.role
    const interests = profile.interests

    return (
      <div className="appShell">
        <aside className="sidebar" aria-label="Навигация">
          <div className="sidebarBrand" onClick={() => navigate('/map')} role="button" tabIndex={0}>
            Кубань.Смотри!
          </div>

          <div className="sidebarNav">
            <SidebarItem label="Интерактивная карта" to="/map" active={activePath === '/map'} />
            <SidebarItem
              label={`Мои путешествия${trips.length ? ` (${trips.length})` : ''}`}
              to="/trips"
              active={activePath === '/trips'}
            />
            <SidebarItem label="История поездок" to="/history" active={activePath === '/history'} />
            <SidebarItem label="Профиль и интересы" to="/profile" active={activePath === '/profile'} />
            <SidebarItem
              label={`Рекомендации: ${profile.interests ? profile.interests.season : ''}`.trim()}
              to="/recommendations"
              active={activePath === '/recommendations'}
            />

            {role === 'partner' && (
              <>
                <div className="sidebarDivider" />
                <SidebarItem label="Мои локации" to="/partner/locations" active={activePath === '/partner'} />
                <SidebarItem label="Добавить объект" to="/partner/add" active={false} />
              </>
            )}
          </div>

          <div className="sidebarFooter">
            <button type="button" className="navItem" onClick={onLogout}>
              Выход
            </button>
          </div>
        </aside>

        <div className="contentArea">
          <header className="navbar mobileTopbar">
            <button
              type="button"
              className="burger"
              onClick={() => setDrawerOpen((v) => !v)}
              aria-label="Открыть меню"
            >
              Меню
            </button>
            <div className="mobileBrand" onClick={() => navigate('/map')} role="button" tabIndex={0}>
              Кубань.Смотри!
            </div>
          </header>

          <div className={`drawerOverlay ${drawerOpen ? 'open' : ''}`} onClick={() => setDrawerOpen(false)} />
          <aside className={`drawer ${drawerOpen ? 'open' : ''}`} aria-label="Мобильное меню">
            <div className="drawerInner">
              <SidebarItem
                label="Интерактивная карта"
                to="/map"
                active={activePath === '/map'}
                onNavigate={() => setDrawerOpen(false)}
              />
              <SidebarItem
                label={`Мои путешествия${trips.length ? ` (${trips.length})` : ''}`}
                to="/trips"
                active={activePath === '/trips'}
                onNavigate={() => setDrawerOpen(false)}
              />
              <SidebarItem
                label="История поездок"
                to="/history"
                active={activePath === '/history'}
                onNavigate={() => setDrawerOpen(false)}
              />
              <SidebarItem
                label="Профиль и интересы"
                to="/profile"
                active={activePath === '/profile'}
                onNavigate={() => setDrawerOpen(false)}
              />
              <SidebarItem
                label="Рекомендации сезона"
                to="/recommendations"
                active={activePath === '/recommendations'}
                onNavigate={() => setDrawerOpen(false)}
              />

              {role === 'partner' && (
                <>
                  <div className="sidebarDivider" />
                  <SidebarItem
                    label="Мои локации"
                    to="/partner/locations"
                    active={activePath === '/partner'}
                    onNavigate={() => setDrawerOpen(false)}
                  />
                  <SidebarItem
                    label="Добавить объект"
                    to="/partner/add"
                    active={false}
                    onNavigate={() => setDrawerOpen(false)}
                  />
                </>
              )}

              <div className="sidebarDivider" />
              <button type="button" className="navItem" onClick={() => (setDrawerOpen(false), onLogout())}>
                Выход
              </button>
            </div>
          </aside>

          <main className="main">
            <Routes>
              <Route path="/map" element={<InteractiveMap profile={profile} />} />

              <Route
                path="/generate"
                element={
                  interests ? (
                    <RouteGenerator profile={profile} onPickRoute={(placeIds) => navigate('/map', { state: { placeIds } })} />
                  ) : (
                    <div className="page">
                      Профиль партнёра пока не содержит интересов — перейдите в `Профиль`.
                    </div>
                  )
                }
              />

              <Route path="/trips" element={<TripsPage />} />
              <Route path="/history" element={<div className="page">Заглушка: история поездок.</div>} />

              {/* Полноэкранная “визитка места” */}
              <Route path="/place/:id" element={<PlacePage profile={profile} />} />
              {/* Полноэкранный 360° просмотр (без WebXR) */}
              <Route path="/pano" element={<Pano360View />} />

              <Route path="/profile" element={<Profile profile={profile} onUpdate={(p) => setProfile(p)} />} />

              <Route
                path="/recommendations"
                element={
                  <div className="page">
                    <h2>Рекомендации сезона</h2>
                    <p>{interests ? `Под ваш сезон: ${interests.season === 'any' ? 'Любой' : interests.season}` : '—'}</p>
                    <p style={{ opacity: 0.8 }}>Скоро добавим персональные подборки и “быстрые туры”.</p>
                    <button type="button" className="primaryBtn" onClick={() => navigate('/generate')}>
                      Сгенерировать тур
                    </button>
                  </div>
                }
              />

              <Route path="/partner/locations" element={<div className="page">Заглушка: “Мои локации”.</div>} />
              <Route path="/partner/add" element={<div className="page">Заглушка: “Добавить объект”.</div>} />

              <Route path="/vr" element={<VRView />} />

              <Route path="*" element={<Navigate to="/map" replace />} />
            </Routes>
          </main>
        </div>
      </div>
    )
  }, [activePath, drawerOpen, navigate, profile, trips.length])

  return content
}


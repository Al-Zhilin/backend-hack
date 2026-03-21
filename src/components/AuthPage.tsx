import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'

import type { AuthProfile, UserRole } from '../types'
import { saveProfile } from '../utils/storage'

import RoleChoice from './RoleChoice'
import InterestWizard from './InterestWizard'

const HERO_IMG =
  'https://images.unsplash.com/photo-1504754524776-8f4f37790ca0?auto=format&fit=crop&w=1600&q=70'

function Landing() {
  return (
    <div
      className="landingHero"
      style={{
        backgroundImage: `linear-gradient(180deg, rgba(11,15,26,0.2), rgba(11,15,26,0.95)), url(${HERO_IMG})`,
      }}
    >
      <div className="landingContent">
        <h1 className="landingTitle">KubanHidden</h1>
        <p className="landingSubtitle">
          Генератор персонализированных туров по Краснодарскому краю: интерактивная карта и “дистанционные визиты”
        </p>
      </div>
    </div>
  )
}

function AuthForm(props: { role: UserRole; onSubmit: (email: string) => void }) {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)

  return (
    <form
      className="authForm"
      onSubmit={(e) => {
        e.preventDefault()
        setError(null)
        const trimmed = email.trim()
        if (!trimmed || !trimmed.includes('@')) {
          setError('Введите корректный email')
          return
        }
        props.onSubmit(trimmed)
      }}
    >
      <label className="field">
        <span className="label">Email</span>
        <input
          className="input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="name@example.com"
          inputMode="email"
        />
      </label>
      {error && <div className="formError">{error}</div>}

      <button type="submit" className="primaryBtn full">
        {props.role === 'traveler' ? 'Начать как путешественник' : 'Создать профиль партнёра'}
      </button>
    </form>
  )
}

export default function AuthPage(props: { onDone: (profile: AuthProfile) => void }) {
  const navigate = useNavigate()

  const [role, setRole] = useState<UserRole | null>(null)
  const [stage, setStage] = useState<'landing' | 'role' | 'auth' | 'wizard' | 'partnerDone'>('landing')

  const [tempEmail, setTempEmail] = useState<string | null>(null)

  const title = useMemo(() => {
    if (stage === 'wizard') return 'Опрос интересов'
    if (stage === 'auth') return 'Регистрация / вход'
    if (stage === 'partnerDone') return 'Профиль партнёра'
    return ''
  }, [stage])

  return (
    <div className="authWrap">
      <div className="authHeader">
        <div className="authLogo">Кубань.Смотри!</div>
        <div className="authHeaderTitle">{title}</div>
      </div>

      <div className="authGrid">
        <div className="authLeft">
          <Landing />
        </div>

        <div className="authRight">
          <AnimatePresence mode="wait">
            {stage === 'landing' && (
              <motion.div
                key="landing"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <RoleChoice
                  onChoose={(r) => {
                    setRole(r)
                    setStage('auth')
                  }}
                />
              </motion.div>
            )}

            {stage === 'auth' && role && (
              <motion.div
                key="auth"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <AuthForm
                  role={role}
                  onSubmit={(email) => {
                    setTempEmail(email)
                    if (role === 'partner') {
                      const profile: AuthProfile = {
                        role,
                        email,
                        partner: { locations: [] },
                        createdAt: Date.now(),
                      }
                      saveProfile(profile)
                      props.onDone(profile)
                      navigate('/map')
                      return
                    }
                    const draft: AuthProfile = {
                      role,
                      email,
                      createdAt: Date.now(),
                    }
                    saveProfile(draft)
                    setStage('wizard')
                  }}
                />
              </motion.div>
            )}

            {stage === 'wizard' && role === 'traveler' && tempEmail && (
              <motion.div
                key="wizard"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <InterestWizard
                  onComplete={(interests) => {
                    const profile: AuthProfile = {
                      role: 'traveler',
                      email: tempEmail,
                      interests,
                      createdAt: Date.now(),
                    }
                    saveProfile(profile)
                    props.onDone(profile)
                    navigate('/map')
                  }}
                />
              </motion.div>
            )}

            {stage === 'partnerDone' && (
              <motion.div key="partnerDone" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                Профиль создан.
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}


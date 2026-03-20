import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { ActivityLevelId, CompanionId, Interests, PlaceTypeId, SeasonId, VacationTypeId } from '../types'

const TOTAL = 7

const VACATION_OPTIONS: Array<{ id: VacationTypeId; label: string }> = [
  { id: 'sea', label: 'Море' },
  { id: 'mountains', label: 'Горы' },
  { id: 'nature', label: 'Леса / природа' },
  { id: 'culture', label: 'Культурный' },
  { id: 'gastro', label: 'Гастрономический' },
  { id: 'wine', label: 'Винный' },
  { id: 'active', label: 'Активный / треккинг' },
  { id: 'wellness', label: 'Оздоровительный' },
  { id: 'family', label: 'Семейный спокойный' },
]

const PLACE_OPTIONS: Array<{ id: PlaceTypeId; label: string }> = [
  { id: 'wineries', label: 'Винодельни' },
  { id: 'cheese_farms', label: 'Сыроварни / фермы' },
  { id: 'cossack_stations', label: 'Казачьи станицы' },
  { id: 'eco_farms', label: 'Эко-фермы' },
  { id: 'reserves', label: 'Заповедники' },
  { id: 'trekking_routes', label: 'Треккинговые маршруты' },
  { id: 'festivals', label: 'Фестивали' },
]

const COMPANION_OPTIONS: Array<{ id: CompanionId; label: string }> = [
  { id: 'solo', label: 'Один' },
  { id: 'couple', label: 'Пара' },
  { id: 'family', label: 'Семья с детьми' },
  { id: 'elder', label: 'Пожилые родственники' },
  { id: 'friends', label: 'Друзья' },
  { id: 'freelancers', label: 'Фрилансеры с ноутбуком' },
]

const SEASON_OPTIONS: Array<{ id: SeasonId; label: string }> = [
  { id: 'spring', label: 'Весна' },
  { id: 'summer', label: 'Лето' },
  { id: 'autumn', label: 'Осень' },
  { id: 'winter', label: 'Зима' },
  { id: 'any', label: 'Любой' },
]

const ACTIVITY_OPTIONS: Array<{ id: ActivityLevelId; label: string }> = [
  { id: 'low', label: 'Низкий (экскурсии и дегустации)' },
  { id: 'medium', label: 'Средний (легкие прогулки)' },
  { id: 'high', label: 'Высокий (треккинг)' },
]

const TRANSFER_OPTIONS: Array<{ id: Interests['transferComfort']; label: string }> = [
  { id: 'short', label: 'Короткие переезды' },
  { id: 'balanced', label: 'Баланс' },
  { id: 'long', label: 'Готовы к дальним переездам' },
]

export default function InterestWizard(props: { onComplete: (interests: Interests) => void; initialInterests?: Partial<Interests> }) {
  const [step, setStep] = useState(0)

  const [vacationTypes, setVacationTypes] = useState<VacationTypeId[]>(
    props.initialInterests?.vacationTypes ?? [],
  )
  const [placeTypes, setPlaceTypes] = useState<PlaceTypeId[]>(
    props.initialInterests?.placeTypes ?? [],
  )
  const [companions, setCompanions] = useState<CompanionId>(props.initialInterests?.companions ?? 'solo')
  const [season, setSeason] = useState<SeasonId>(props.initialInterests?.season ?? 'any')
  const [activityLevel, setActivityLevel] = useState<ActivityLevelId>(
    props.initialInterests?.activityLevel ?? 'low',
  )
  const [transferComfort, setTransferComfort] = useState<Interests['transferComfort']>(
    props.initialInterests?.transferComfort ?? 'balanced',
  )
  const [displayName, setDisplayName] = useState<string>(props.initialInterests?.displayName ?? '')

  const [error, setError] = useState<string | null>(null)

  const progress = (step + 1) / TOTAL

  const canNext = useMemo(() => {
    if (step === 0) return vacationTypes.length > 0
    if (step === 1) return true // placeTypes может быть пустым = “пропустить”
    if (step === 2) return Boolean(companions)
    if (step === 3) return Boolean(season)
    if (step === 4) return Boolean(activityLevel)
    if (step === 5) return Boolean(transferComfort)
    if (step === 6) return displayName.trim().length >= 2
    return true
  }, [step, activityLevel, companions, displayName, season, transferComfort, vacationTypes])

  const stepsLabel = `Вопрос ${step + 1} из ${TOTAL}`

  return (
    <div className="wizard">
      <div className="wizardTop">
        <div className="wizardProgressLabel">{stepsLabel}</div>
        <div className="wizardProgressBar" aria-hidden="true">
          <div className="wizardProgressFill" style={{ width: `${progress * 100}%` }} />
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.25 }}
        >
          {step === 0 && (
            <div className="wizardStep">
              <h2 className="wizardTitle">Какой отдых предпочитаете?</h2>
              <p className="wizardHint">Выберите несколько вариантов.</p>
              <div className="choiceGrid">
                {VACATION_OPTIONS.map((opt) => {
                  const checked = vacationTypes.includes(opt.id)
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      className={`choice ${checked ? 'checked' : ''}`}
                      onClick={() => {
                        setVacationTypes((prev) =>
                          checked ? prev.filter((x) => x !== opt.id) : [...prev, opt.id],
                        )
                      }}
                    >
                      {opt.label}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="wizardStep">
              <h2 className="wizardTitle">Интересуют ли места?</h2>
              <p className="wizardHint">Можно выбрать несколько. Или нажать “Пропустить”.</p>

              <div className="choiceGrid choiceGrid2">
                <button
                  type="button"
                  className={`choice ${placeTypes.length === 0 ? 'checked' : ''}`}
                  onClick={() => setPlaceTypes([])}
                >
                  Пропустить
                </button>
                {PLACE_OPTIONS.map((opt) => {
                  const checked = placeTypes.includes(opt.id)
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      className={`choice ${checked ? 'checked' : ''}`}
                      onClick={() => {
                        setPlaceTypes((prev) => (checked ? prev.filter((x) => x !== opt.id) : [...prev, opt.id]))
                      }}
                    >
                      {opt.label}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="wizardStep">
              <h2 className="wizardTitle">С кем едете?</h2>
              <div className="choiceStack">
                {COMPANION_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    className={`choice choiceRadio ${companions === opt.id ? 'checked' : ''}`}
                    onClick={() => setCompanions(opt.id)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="wizardStep">
              <h2 className="wizardTitle">Сезон поездки</h2>
              <div className="choiceStack">
                {SEASON_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    className={`choice choiceRadio ${season === opt.id ? 'checked' : ''}`}
                    onClick={() => setSeason(opt.id)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="wizardStep">
              <h2 className="wizardTitle">Уровень активности</h2>
              <div className="choiceStack">
                {ACTIVITY_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    className={`choice choiceRadio ${activityLevel === opt.id ? 'checked' : ''}`}
                    onClick={() => setActivityLevel(opt.id)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="wizardStep">
              <h2 className="wizardTitle">Комфорт в дороге</h2>
              <p className="wizardHint">Повлияет на “взвешивание” маршрута.</p>
              <div className="choiceStack">
                {TRANSFER_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    className={`choice choiceRadio ${transferComfort === opt.id ? 'checked' : ''}`}
                    onClick={() => setTransferComfort(opt.id)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 6 && (
            <div className="wizardStep">
              <h2 className="wizardTitle">Как к вам обращаться?</h2>
              <label className="field">
                <span className="label">Имя</span>
                <input
                  className="input"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Например: Валерия"
                />
              </label>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {error && <div className="formError">{error}</div>}

      <div className="wizardActions">
        <button
          type="button"
          className="secondaryBtn"
          disabled={step === 0}
          onClick={() => {
            setError(null)
            setStep((s) => Math.max(0, s - 1))
          }}
        >
          Назад
        </button>

        {step < TOTAL - 1 ? (
          <button
            type="button"
            className="primaryBtn"
            disabled={!canNext}
            onClick={() => {
              setError(null)
              if (!canNext) {
                setError('Заполните обязательные поля перед продолжением.')
                return
              }
              setStep((s) => Math.min(TOTAL - 1, s + 1))
            }}
          >
            Далее
          </button>
        ) : (
          <button
            type="button"
            className="primaryBtn"
            onClick={() => {
              setError(null)
              if (!canNext) {
                setError('Проверьте ответы перед сохранением.')
                return
              }
              const interests: Interests = {
                vacationTypes,
                placeTypes,
                companions,
                season,
                activityLevel,
                transferComfort,
                displayName: displayName.trim(),
              }
              props.onComplete(interests)
            }}
          >
            Сохранить профиль
          </button>
        )}
      </div>
    </div>
  )
}


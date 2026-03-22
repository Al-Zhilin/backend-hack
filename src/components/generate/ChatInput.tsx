import { useState } from 'react'
import Preloader from '../Preloader'

type ChatInputProps = {
  loading: boolean
  onSend: (prompt: string) => Promise<void> | void
  /** Контролируемое значение (для быстрых подсказок с родителя) */
  value?: string
  onValueChange?: (v: string) => void
}

export default function ChatInput(props: ChatInputProps) {
  const [internal, setInternal] = useState('')
  const controlled = props.value !== undefined
  const value = controlled ? props.value! : internal

  const setValue = (v: string) => {
    if (props.onValueChange) props.onValueChange(v)
    else setInternal(v)
  }

  return (
    <div className="generateComposer">
      {props.loading && (
        <div className="generateComposer__status">
          <Preloader variant="inline" label="Обработка запроса…" />
        </div>
      )}
      <div className="generateComposer__row">
        <textarea
          className="generateComposer__input"
          rows={2}
          value={value}
          placeholder="Опишите поездку: кто едет, сколько дней, бюджет, что хотите увидеть…"
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && value.trim() && !props.loading) {
              e.preventDefault()
              void props.onSend(value.trim())
              setValue('')
            }
          }}
        />
        <button
          type="button"
          className="generateComposer__send"
          disabled={!value.trim() || props.loading}
          aria-label="Отправить"
          onClick={() => {
            if (!value.trim()) return
            void props.onSend(value.trim())
            setValue('')
          }}
        >
          {props.loading ? (
            <span className="generateComposer__sendDots">…</span>
          ) : (
            <svg className="generateComposer__sendIcon" width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M4 12l16-8-8 16-2-6-6-2z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </button>
      </div>
      <p className="generateComposer__hint">Enter — отправить · Shift+Enter — новая строка</p>
    </div>
  )
}

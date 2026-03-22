import { useCallback, useEffect, useRef, useState } from 'react'
import Preloader from '../Preloader'
import { transcribeAudioBlob } from '../../utils/whisperTranscribe'

type ChatInputProps = {
  loading: boolean
  onSend: (prompt: string) => Promise<void> | void
  /** Контролируемое значение (для быстрых подсказок с родителя) */
  value?: string
  onValueChange?: (v: string) => void
}

function pickMime(): string | undefined {
  const c = 'audio/webm;codecs=opus'
  if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(c)) return c
  return undefined
}

export default function ChatInput(props: ChatInputProps) {
  const [internal, setInternal] = useState('')
  const controlled = props.value !== undefined
  const value = controlled ? props.value! : internal

  const [recording, setRecording] = useState(false)
  const [voiceBusy, setVoiceBusy] = useState(false)
  const [voiceHint, setVoiceHint] = useState<string | null>(null)
  const [voiceError, setVoiceError] = useState<string | null>(null)

  const mediaRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const setValue = (v: string) => {
    if (props.onValueChange) props.onValueChange(v)
    else setInternal(v)
  }

  useEffect(() => {
    return () => {
      mediaRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  const stopRecordingAndTranscribe = useCallback(async () => {
    const rec = recorderRef.current
    const stream = mediaRef.current
    if (!rec || rec.state === 'inactive') {
      stream?.getTracks().forEach((t) => t.stop())
      mediaRef.current = null
      setRecording(false)
      return
    }

    await new Promise<void>((resolve) => {
      rec.onstop = () => resolve()
      rec.stop()
    })
    stream?.getTracks().forEach((t) => t.stop())
    mediaRef.current = null
    recorderRef.current = null
    setRecording(false)

    const chunks = chunksRef.current
    chunksRef.current = []
    const blob = new Blob(chunks, { type: chunks[0]?.type || 'audio/webm' })
    if (blob.size < 2000) {
      setVoiceError('Слишком короткая запись')
      return
    }

    setVoiceBusy(true)
    setVoiceHint('Распознавание…')
    setVoiceError(null)
    try {
      const text = await transcribeAudioBlob(blob)
      if (text) {
        const next = value.trim() ? `${value.trim()} ${text}` : text
        const toSend = next.trim()
        if (props.loading) {
          setValue(next)
        } else if (toSend) {
          void props.onSend(toSend)
          setValue('')
        }
      } else {
        setVoiceError('Речь не распознана')
      }
    } catch (e) {
      setVoiceError(e instanceof Error ? e.message : 'Ошибка распознавания')
    } finally {
      setVoiceBusy(false)
      setVoiceHint(null)
    }
  }, [value, setValue, props.loading, props.onSend])

  const toggleMic = async () => {
    if (props.loading || voiceBusy) return
    if (recording) {
      await stopRecordingAndTranscribe()
      return
    }
    setVoiceError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaRef.current = stream
      chunksRef.current = []
      const mime = pickMime()
      const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      mr.start(200)
      recorderRef.current = mr
      setRecording(true)
    } catch {
      setVoiceError('Нет доступа к микрофону')
    }
  }

  const showVoiceStatus =
    recording || (props.loading && !recording) || voiceBusy || !!voiceHint

  return (
    <div className="generateComposer">
      {(props.loading || showVoiceStatus) && (
        <div className="generateComposer__status">
          {props.loading && !recording ? (
            <Preloader variant="inline" label="Обработка запроса…" />
          ) : recording ? (
            <Preloader variant="inline" label="Запись… нажмите микрофон ещё раз, чтобы распознать" />
          ) : voiceBusy || voiceHint ? (
            <Preloader variant="inline" label={voiceHint ?? '…'} />
          ) : null}
        </div>
      )}
      {voiceError && <p className="generateComposer__voiceError">{voiceError}</p>}
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
          disabled={voiceBusy}
        />
        <div className="generateComposer__actions">
          <button
            type="button"
            className={`generateComposer__mic ${recording ? 'generateComposer__mic--rec' : ''}`}
            disabled={props.loading || voiceBusy}
            aria-label={recording ? 'Остановить запись' : 'Голосовой ввод'}
            aria-pressed={recording}
            onClick={() => void toggleMic()}
          >
            <svg className="generateComposer__micIcon" width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M12 14a3 3 0 003-3V6a3 3 0 10-6 0v5a3 3 0 003 3zm5-3a5 5 0 01-10 0H5a7 7 0 0014 0h-2zM11 19v2h2v-2h-2z"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <button
            type="button"
            className="generateComposer__send"
            disabled={!value.trim() || props.loading || voiceBusy}
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
      </div>
      <p className="generateComposer__hint">
        Enter — отправить · Shift+Enter — новая строка · микрофон — голос; после распознавания сообщение уходит в чат автоматически
      </p>
    </div>
  )
}

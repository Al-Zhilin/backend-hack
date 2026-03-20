import { useState } from 'react'

export default function ChatInput(props: {
  loading: boolean
  onSend: (prompt: string) => Promise<void> | void
}) {
  const [value, setValue] = useState('')

  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <input
        className="input"
        style={{ flex: 1 }}
        value={value}
        placeholder='Например: "семья с детьми, активный отдых на 3 дня"'
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && value.trim() && !props.loading) {
            e.preventDefault()
            void props.onSend(value.trim())
            setValue('')
          }
        }}
      />
      <button
        type="button"
        className="primaryBtn"
        disabled={!value.trim() || props.loading}
        onClick={() => {
          if (!value.trim()) return
          void props.onSend(value.trim())
          setValue('')
        }}
      >
        Отправить
      </button>
    </div>
  )
}


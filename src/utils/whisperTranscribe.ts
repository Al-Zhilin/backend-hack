/** Транскрипция через OpenAI Whisper API (https://platform.openai.com/docs/guides/speech-to-text). */

const TRANSCRIPTIONS_URL = 'https://api.openai.com/v1/audio/transcriptions'

function blobFileName(blob: Blob): string {
  const t = blob.type || ''
  if (t.includes('webm')) return 'audio.webm'
  if (t.includes('mp4') || t.includes('mpeg')) return 'audio.mp4'
  if (t.includes('ogg')) return 'audio.ogg'
  if (t.includes('wav')) return 'audio.wav'
  return 'audio.webm'
}

export async function transcribeAudioBlob(blob: Blob): Promise<string> {
  const key = (import.meta.env.VITE_OPENAI_API_KEY as string | undefined)?.trim()
  if (!key) {
    throw new Error('Задайте VITE_OPENAI_API_KEY в .env')
  }

  const form = new FormData()
  form.append('file', blob, blobFileName(blob))
  form.append('model', 'whisper-1')

  const res = await fetch(TRANSCRIPTIONS_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  })

  if (!res.ok) {
    let detail = res.statusText
    try {
      const err = (await res.json()) as { error?: { message?: string } }
      if (err.error?.message) detail = err.error.message
    } catch {
      try {
        detail = await res.text()
      } catch {
        /* ignore */
      }
    }
    throw new Error(detail || `OpenAI ${res.status}`)
  }

  const data = (await res.json()) as { text?: string }
  return typeof data.text === 'string' ? data.text.trim() : ''
}

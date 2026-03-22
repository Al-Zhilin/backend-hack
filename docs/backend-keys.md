# Ключи API на бэкенде

Цель: не хранить секреты во фронтенде (`VITE_*` попадают в собранный JS и видны всем).

## Важно: «роут, который вернул ключи»

**Не стоит** делать публичный эндпоинт вида `GET /api/keys`, который отдаёт `OPENAI_API_KEY` или полный набор секретов. Ответ всё равно окажется в браузере, DevTools и логах — это не лучше, чем `VITE_OPENAI_API_KEY`.

Разумные варианты:

| Ключ | Где должен жить | Как фронт использует |
|------|-----------------|----------------------|
| **OpenAI** (Whisper и т.д.) | Только сервер | Фронт шлёт **аудио** на ваш бэкенд → бэкенд вызывает OpenAI с ключом из `process.env`. |
| **Geoapify / Yandex Maps** | Часто остаются на клиенте (ключи с ограничением по домену/referrer) | Либо как сейчас через `VITE_*`, либо один раз подтянуть **публичные** ключи с бэкенда (см. ниже). |

---

## 1. Рекомендуемый вариант: прокси Whisper (ключ не покидает сервер)

На бэкенде в `.env` (не коммитить):

```env
OPENAI_API_KEY=sk-proj-...
```

### Поведение

- Клиент: `POST /api/transcribe` с телом `multipart/form-data`, поле `file` — тот же blob/webm, что сейчас уходит в OpenAI.
- Сервер: пересылает файл на `https://api.openai.com/v1/audio/transcriptions` с заголовком `Authorization: Bearer ${OPENAI_API_KEY}` и полями `model=whisper-1`.
- Ответ клиенту: JSON `{ "text": "..." }` как у OpenAI (или только текст).

### Пример: Express (Node)

```js
import express from 'express'
import multer from 'multer'
import FormData from 'form-data'
import fetch from 'node-fetch'

const upload = multer({ storage: multer.memoryStorage() })
const app = express()

app.post('/api/transcribe', upload.single('file'), async (req, res) => {
  try {
    if (!req.file?.buffer) {
      return res.status(400).json({ error: 'file required' })
    }
    const key = process.env.OPENAI_API_KEY
    if (!key) {
      return res.status(500).json({ error: 'OPENAI_API_KEY is not set' })
    }

    const form = new FormData()
    form.append('file', req.file.buffer, {
      filename: req.file.originalname || 'audio.webm',
      contentType: req.file.mimetype || 'audio/webm',
    })
    form.append('model', 'whisper-1')

    const r = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, ...form.getHeaders() },
      body: form,
    })
    const data = await r.json()
    if (!r.ok) {
      return res.status(r.status).json(data)
    }
    return res.json({ text: data.text ?? '' })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ error: 'transcription failed' })
  }
})
```

На фронте в `whisperTranscribe.ts` вместо прямого вызова OpenAI — `fetch(`${import.meta.env.VITE_BACKEND_API_URL}/api/transcribe`, { method: 'POST', body: formData })` без ключа.

---

## 2. Роут «вернул ключи»: только для **публичных** клиентских ключей

Если нужно **один раз** отдать фронту ключи карт (они всё равно окажутся в JS), можно сузить задачу:

- В `.env` бэкенда: `VITE_`-аналоги не нужны; храните, например, `GEOAPIFY_API_KEY`, `YANDEX_MAPS_API_KEY`.
- Эндпоинт **только для публичных ключей**, без OpenAI:

`GET /api/public-config` →

```json
{
  "geoapifyApiKey": "...",
  "yandexMapsApiKey": "..."
}
```

Секрет `OPENAI_API_KEY` в этот ответ **не включать**.

Пример (Express):

```js
app.get('/api/public-config', (_req, res) => {
  res.json({
    geoapifyApiKey: process.env.GEOAPIFY_API_KEY,
    yandexMapsApiKey: process.env.YANDEX_MAPS_API_KEY,
  })
})
```

Фронт при старте один раз запрашивает конфиг и кладёт в память/state (или в кэш). Для продакшена имеет смысл добавить CORS только для вашего домена и при желании простую авторизацию, если API не должны звать посторонние сайты.

---

## 3. Что поменять во фронте (кратко)

1. **Whisper**: убрать `VITE_OPENAI_API_KEY`; вызывать `POST ${VITE_BACKEND_API_URL}/api/transcribe` с `FormData` и файлом.
2. **Остальное**: либо оставить `VITE_*` для карт/Geoapify, либо подгружать из `GET /api/public-config` и не дублировать ключи в репозитории фронта.

Если нужно, могу в коде проекта переключить `whisperTranscribe.ts` на URL бэкенда под такой контракт.

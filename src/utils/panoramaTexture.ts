import * as THREE from 'three'

export function createPanoramaTexture(opts: { title: string; subtitle?: string }) {
  const w = 1024
  const h = 512
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    // fallback: минимальная текстура
    const tex = new THREE.CanvasTexture(canvas)
    tex.needsUpdate = true
    return tex
  }

  // Фон “пейзаж” через градиенты
  const bg = ctx.createLinearGradient(0, 0, w, h)
  bg.addColorStop(0, '#0ea5e9')
  bg.addColorStop(0.35, '#22c55e')
  bg.addColorStop(0.7, '#7c3aed')
  bg.addColorStop(1, '#0b0f1a')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, w, h)

  // “Горизонтальные” полосы для глубины
  for (let i = 0; i < 18; i++) {
    const y = (i / 18) * h
    const alpha = 0.08 * (1 - i / 18)
    ctx.fillStyle = `rgba(255,255,255,${alpha})`
    ctx.fillRect(0, y, w, 2)
  }

  // Текст (чтобы в VR было хоть что-то узнаваемое по выбранной локации)
  ctx.fillStyle = 'rgba(0,0,0,0.35)'
  ctx.fillRect(32, h / 2 - 64, w - 64, 140)

  ctx.fillStyle = 'rgba(255,255,255,0.95)'
  ctx.font = 'bold 52px system-ui, -apple-system, Segoe UI, Roboto, Arial'
  ctx.textAlign = 'center'
  ctx.fillText(opts.title, w / 2, h / 2 - 2)

  if (opts.subtitle) {
    ctx.font = '400 26px system-ui, -apple-system, Segoe UI, Roboto, Arial'
    ctx.fillStyle = 'rgba(255,255,255,0.8)'
    ctx.fillText(opts.subtitle, w / 2, h / 2 + 38)
  }

  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.needsUpdate = true
  return tex
}


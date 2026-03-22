import { useCallback, useRef } from 'react'

type SwipeOpts = {
  /** Минимальное смещение по горизонтали (px) */
  threshold?: number
  /** Игнорировать жест, если вертикальное движение больше горизонтального (скролл) */
  preferHorizontal?: boolean
}

/**
 * Горизонтальный свайп: влево → next, вправо → prev (для галерей).
 */
export function useHorizontalSwipe(onNext: () => void, onPrev: () => void, opts: SwipeOpts = {}) {
  const { threshold = 48, preferHorizontal = true } = opts
  const startX = useRef(0)
  const startY = useRef(0)

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length !== 1) return
    startX.current = e.touches[0].clientX
    startY.current = e.touches[0].clientY
  }, [])

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (e.changedTouches.length !== 1) return
      const dx = e.changedTouches[0].clientX - startX.current
      const dy = e.changedTouches[0].clientY - startY.current
      if (preferHorizontal && Math.abs(dx) < Math.abs(dy)) return
      if (Math.abs(dx) < threshold) return
      if (dx < 0) onNext()
      else onPrev()
    },
    [onNext, onPrev, preferHorizontal, threshold],
  )

  return { onTouchStart, onTouchEnd }
}

/**
 * Вертикальный свайп вниз (например, закрыть панель).
 */
export function useVerticalSwipeDown(onClose: () => void, threshold = 72) {
  const startY = useRef(0)

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length !== 1) return
    startY.current = e.touches[0].clientY
  }, [])

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (e.changedTouches.length !== 1) return
      const dy = e.changedTouches[0].clientY - startY.current
      if (dy > threshold) onClose()
    },
    [onClose, threshold],
  )

  return { onTouchStart, onTouchEnd }
}

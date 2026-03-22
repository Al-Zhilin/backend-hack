/**
 * Подписка на выбор метки Яндекс.Карт: клик мыши и тап на сенсорных экранах.
 * API 2.x: событие `click` обычно срабатывает и для тапа; дублируем `tap`, если есть.
 */
export function attachPlacemarkSelect(inst: any, onSelect: () => void) {
  if (!inst?.events?.add) return
  if (inst.__kubanPlacemarkBound) return
  inst.__kubanPlacemarkBound = true

  const handler = () => onSelect()
  inst.events.add('click', handler)

  try {
    if (typeof inst.events.add === 'function') {
      inst.events.add('tap', handler)
    }
  } catch {
    /* tap не во всех сборках */
  }
}

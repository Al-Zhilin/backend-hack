import '../styles/preloader.scss'

export type PreloaderVariant = 'full' | 'overlay' | 'inline' | 'compact' | 'corner'

export default function Preloader(props: {
  label?: string
  sublabel?: string
  variant?: PreloaderVariant
  className?: string
}) {
  const v = props.variant ?? 'full'
  return (
    <div
      className={`preloader preloader--${v} ${props.className ?? ''}`.trim()}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="preloader-spinner" aria-hidden />
      {props.label && <div className="preloader-label">{props.label}</div>}
      {props.sublabel && <div className="preloader-sublabel">{props.sublabel}</div>}
    </div>
  )
}

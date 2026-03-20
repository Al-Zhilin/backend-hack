export default function PlaceFullWidthHero(props: { image: string; title: string; subtitle?: string }) {
  return (
    <div
      style={{
        borderRadius: 22,
        overflow: 'hidden',
        border: '1px solid var(--border)',
        background: 'rgba(255,255,255,0.02)',
        position: 'relative',
        minHeight: 220,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `url(${props.image})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          filter: 'saturate(1.05) contrast(1.05)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(180deg, rgba(0,0,0,0.2), rgba(0,0,0,0.85))',
        }}
      />
      <div style={{ position: 'relative', padding: 18 }}>
        <div style={{ fontSize: 30, fontWeight: 1000, lineHeight: 1.1 }}>{props.title}</div>
        {props.subtitle && <div style={{ marginTop: 8, opacity: 0.9, fontWeight: 750 }}>{props.subtitle}</div>}
      </div>
    </div>
  )
}


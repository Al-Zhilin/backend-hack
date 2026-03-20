import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { useMemo } from 'react'
import { useLoader } from '@react-three/fiber'
import { useNavigate, useSearchParams } from 'react-router-dom'

import { LOCATIONS } from '../data/locations'
import { createPanoramaTexture } from '../utils/panoramaTexture'
import type { Location } from '../data/locations'

function SphereWith360Url(props: { url: string; title: string }) {
  const texture = useLoader(THREE.TextureLoader, props.url)

  // На всякий случай выставим цветовое пространство.
  texture.colorSpace = THREE.SRGBColorSpace

  return (
    <mesh>
      <sphereGeometry args={[100, 64, 32]} />
      <meshBasicMaterial map={texture} side={THREE.BackSide} />
    </mesh>
  )
}

function SphereFallback(props: { place: Location | null }) {
  const texture = useMemo(() => {
    const title = props.place?.name ?? 'KubanHidden'
    const subtitle = props.place ? props.place.placeTypes[0] : undefined
    return createPanoramaTexture({ title, subtitle })
  }, [props.place])

  return (
    <mesh>
      <sphereGeometry args={[100, 64, 32]} />
      <meshBasicMaterial map={texture} side={THREE.BackSide} />
    </mesh>
  )
}

export default function Pano360View() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const placeId = params.get('placeId')

  const place = useMemo(() => {
    if (!placeId) return null
    return LOCATIONS.find((l) => l.id === placeId) ?? null
  }, [placeId])

  const url360 = place?.['360_photo_url']

  return (
    <div style={{ height: '100%', width: '100%', position: 'relative' }}>
      <button
        type="button"
        className="secondaryBtn"
        onClick={() => navigate('/map')}
        style={{
          position: 'absolute',
          zIndex: 10,
          top: 12,
          left: 12,
        }}
      >
        Назад
      </button>

      <Canvas
        camera={{ position: [0, 0, 0.01], fov: 75 }}
        gl={{ antialias: true }}
        style={{ height: '100%', width: '100%' }}
      >
        {url360 ? <SphereWith360Url url={url360} title={place?.name ?? ''} /> : <SphereFallback place={place} />}
        <ambientLight intensity={0.8} />
        <OrbitControls enablePan={false} enableZoom={false} />
      </Canvas>
    </div>
  )
}


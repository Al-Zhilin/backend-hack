import { useEffect, useMemo, useState } from 'react'
import * as THREE from 'three'
import { Canvas, useLoader, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { useNavigate, useSearchParams } from 'react-router-dom'

import { LOCATIONS } from '../data/locations'
import { createPanoramaTexture } from '../utils/panoramaTexture'
import type { Location } from '../data/locations'

function SphereWith360Url(props: { url: string }) {
  const texture = useLoader(THREE.TextureLoader, props.url)
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

function VRControls(props: { place: Location | null }) {
  const { gl, camera } = useThree()
  const [supported, setSupported] = useState<boolean | null>(null)
  const [entering, setEntering] = useState(false)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const xr = (navigator as any).xr
        if (!xr?.isSessionSupported) {
          if (mounted) setSupported(false)
          return
        }
        const ok = await xr.isSessionSupported('immersive-vr')
        if (mounted) setSupported(Boolean(ok))
      } catch {
        if (mounted) setSupported(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [])

  const startVR = async () => {
    const xr = (navigator as any).xr
    if (!xr) return

    setEntering(true)
    try {
      const session = await xr.requestSession('immersive-vr', {
        optionalFeatures: ['local-floor', 'bounded-floor'],
      })
      gl.xr.enabled = true
      gl.xr.setReferenceSpaceType('local')
      gl.xr.setSession(session)

      session.addEventListener('end', () => {
        // React state для MVP не обновляем: Canvas продолжит работать
      })
    } finally {
      setEntering(false)
    }
  }

  // В VR будет другая камера; OrbitControls не нужны
  useEffect(() => {
    camera.position.set(0, 0.01, 0.01)
  }, [camera])

  return (
    <Html center style={{ pointerEvents: 'auto' }}>
      <div style={{ maxWidth: 520, textAlign: 'center' }}>
        <div style={{ fontWeight: 900, fontSize: 20 }}>{props.place?.name ?? 'Дистанционный визит'}</div>
        <div style={{ opacity: 0.85, marginTop: 6 }}>
          Введите VR-режим, если устройство поддерживает WebXR.
        </div>
        <button
          className="primaryBtn"
          type="button"
          onClick={startVR}
          disabled={!supported || entering}
          style={{ marginTop: 14 }}
        >
          {entering ? 'Запуск...' : supported ? 'Войти в VR-режим' : 'VR не поддерживается'}
        </button>
        <div style={{ opacity: 0.7, marginTop: 10, fontSize: 14 }}>
          Подсказка: на мобильном попробуйте браузер с поддержкой WebXR.
        </div>
      </div>
    </Html>
  )
}

function VRScene(props: { place: Location | null }) {
  return (
    <>
      {props.place?.['360_photo_url'] ? <SphereWith360Url url={props.place['360_photo_url']} /> : <SphereFallback place={props.place} />}
      <VRControls place={props.place} />
    </>
  )
}

export default function VRView() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const placeId = params.get('placeId')

  const place = useMemo(() => {
    if (!placeId) return null
    return LOCATIONS.find((l) => l.id === placeId) ?? null
  }, [placeId])

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
          pointerEvents: 'auto',
        }}
      >
        Назад
      </button>

      <Canvas
        camera={{ position: [0, 0, 0.01], fov: 75 }}
        gl={{ antialias: true }}
      >
        <VRScene place={place} />
      </Canvas>
    </div>
  )
}


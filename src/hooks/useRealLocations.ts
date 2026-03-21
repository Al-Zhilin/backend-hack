// src/hooks/useRealLocations.ts
import { useState, useEffect } from 'react'
import type { Location } from '../data/locations'
import { fetchRealLocations } from '../data/locations'  // ← импорт из правильного файла

export function useRealLocations() {
  const [locations, setLocations] = useState<Location[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    const loadLocations = async () => {
      try {
        setLoading(true)
        setError(null)
        
        console.log('🔄 useRealLocations: Starting to fetch locations...')
        const data = await fetchRealLocations()
        
        if (mounted) {
          setLocations(data)
          console.log(`✅ useRealLocations: Loaded ${data.length} real locations from Geoapify`)
        }
      } catch (err) {
        if (mounted) {
          const errorMessage = err instanceof Error ? err.message : 'Не удалось загрузить места'
          setError(errorMessage)
          console.error('❌ useRealLocations: Error loading locations:', err)
        }
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    loadLocations()

    return () => {
      mounted = false
    }
  }, [])

  return { 
    locations, 
    loading, 
    error,
    hasLocations: locations.length > 0
  }
}
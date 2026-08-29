import { useCallback, useEffect, useState } from 'react'
import { getClientProfile } from '../api/account'
import { getZone, listCountries, listServices, listZones } from '../api/catalog'
import type { Country, Zone } from '../types'

export interface ResolvedLocation {
  loading: boolean
  error: string | null
  country: Country | null
  zones: Zone[]
  /** Quartier par défaut du client, s'il en a enregistré un. */
  homeZoneId: string | null
  retry: () => void
}

// Résout le pays et la liste des quartiers pour le client courant :
//  - si le profil a un homeZoneId -> on part de ce quartier (et de son pays) ;
//  - sinon -> repli sur le premier pays qui a des quartiers configurés.
// Même logique que apps/mobile (NewBookingScreen._load / ClientProfileScreen).
export function useResolvedLocation(): ResolvedLocation {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [country, setCountry] = useState<Country | null>(null)
  const [zones, setZones] = useState<Zone[]>([])
  const [homeZoneId, setHomeZoneId] = useState<string | null>(null)
  const [nonce, setNonce] = useState(0)

  const retry = useCallback(() => setNonce((n) => n + 1), [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const countries = await listCountries()

        let resolvedCountryId: string | null = null
        let resolvedHomeZoneId: string | null = null

        try {
          const profile = await getClientProfile()
          if (profile.homeZoneId) {
            const zone = await getZone(profile.homeZoneId)
            if (zone.countryId) {
              resolvedCountryId = zone.countryId
              resolvedHomeZoneId = zone.id
            }
          }
        } catch {
          // pas de profil exploitable -> repli ci-dessous
        }

        let zoneList: Zone[] = []
        let resolvedCountry: Country | null = null

        if (resolvedCountryId) {
          resolvedCountry = countries.find((c) => c.id === resolvedCountryId) ?? null
          zoneList = await listZones(resolvedCountryId)
        } else {
          // Repli : premier pays qui a A LA FOIS des quartiers ET un
          // catalogue de services actif. Sans le test des services, on
          // tombe sur un pays de test (ex : Belgique -> quartiers mais
          // aucun service) et la reservation reste bloquee -- meme
          // correctif que findFirstCountryWithZones cote mobile.
          for (const c of countries) {
            const list = await listZones(c.id)
            if (list.length === 0) continue
            const services = await listServices(c.id)
            if (services.length === 0) continue
            resolvedCountry = c
            zoneList = list
            break
          }
        }

        if (cancelled) return
        if (!resolvedCountry || zoneList.length === 0) {
          setError('Aucune zone configurée pour le moment.')
        }
        setCountry(resolvedCountry)
        setZones(zoneList)
        setHomeZoneId(resolvedHomeZoneId)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [nonce])

  return { loading, error, country, zones, homeZoneId, retry }
}

import type { Zone } from '../types'

// "Douala - Akwa" (cityName "Douala") -> "Akwa" ; sinon le nom complet.
export function districtLabel(zone: Pick<Zone, 'name' | 'cityName'>): string {
  const prefix = `${zone.cityName} - `
  return zone.name.startsWith(prefix) ? zone.name.slice(prefix.length) : zone.name
}

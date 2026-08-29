// Géographie + catalogue de services. Toutes ces routes sont publiques.
import { apiRequest } from './client'
import type { CodeName, Country, GarmentType, ServiceCategory, Zone } from '../types'

export function listCountries(): Promise<Country[]> {
  return apiRequest<Country[]>('GET', '/countries', { auth: false })
}

export function listZones(countryId: string): Promise<Zone[]> {
  return apiRequest<Zone[]>('GET', `/countries/${countryId}/zones`, { auth: false })
}

// GET /zones/:id renvoie aussi countryId + countryName (commit backend
// dédié) — permet d'afficher pays / ville / quartier séparément.
export function getZone(zoneId: string): Promise<Zone> {
  return apiRequest<Zone>('GET', `/zones/${zoneId}`, { auth: false })
}

export function listServices(countryId: string): Promise<ServiceCategory[]> {
  return apiRequest<ServiceCategory[]>('GET', `/services?countryId=${countryId}`, { auth: false })
}

export function listGarmentTypes(countryId: string): Promise<GarmentType[]> {
  return apiRequest<GarmentType[]>('GET', `/laundry/garment-types?countryId=${countryId}`, {
    auth: false,
  })
}

export function listFabricCategories(): Promise<CodeName[]> {
  return apiRequest<CodeName[]>('GET', '/laundry/fabric-categories', { auth: false })
}

export function listWashMethods(): Promise<CodeName[]> {
  return apiRequest<CodeName[]>('GET', '/laundry/wash-methods', { auth: false })
}

export function listStainTypes(): Promise<CodeName[]> {
  return apiRequest<CodeName[]>('GET', '/laundry/stain-types', { auth: false })
}

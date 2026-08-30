import { apiRequest } from './client'
import type { Address, ClientProfile, IncidentSeverity, NotificationItem } from '../types'

export function getClientProfile(): Promise<ClientProfile> {
  return apiRequest<ClientProfile>('GET', '/client/profile')
}

export function updateHomeZone(zoneId: string): Promise<ClientProfile> {
  return apiRequest<ClientProfile>('PATCH', '/client/profile', { body: { zoneId } })
}

export function listAddresses(): Promise<Address[]> {
  return apiRequest<Address[]>('GET', '/addresses')
}

export function createAddress(input: {
  zoneId: string
  label: string
  landmark: string
  latitude: number
  longitude: number
}): Promise<Address> {
  return apiRequest<Address>('POST', '/addresses', { body: input })
}

export function listNotifications(): Promise<NotificationItem[]> {
  return apiRequest<NotificationItem[]>('GET', '/notifications')
}

export function reportIncident(input: {
  bookingId?: string
  type: string
  severity: IncidentSeverity
  description: string
}): Promise<void> {
  return apiRequest<void>('POST', '/incidents', { body: input })
}

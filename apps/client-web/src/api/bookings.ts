import { apiRequest } from './client'
import type { Booking, QuoteResult } from '../types'

export interface LaundryItemInput {
  garmentTypeId: string
  quantity: number
  fabricCategoryCode: string
  washMethodCode: string
  stainTypeCode: string
}

export function laundryQuote(input: {
  serviceCategoryId: string
  zoneId: string
  items: LaundryItemInput[]
  urgent: boolean
}): Promise<QuoteResult> {
  return apiRequest<QuoteResult>('POST', '/pricing/laundry-quote', { body: input })
}

export function genericQuote(input: {
  serviceOptionId: string
  zoneId: string
  urgent: boolean
  hours?: number
}): Promise<QuoteResult> {
  return apiRequest<QuoteResult>('POST', '/pricing/quote', { body: input })
}

export interface CreateBookingInput {
  serviceCategoryId: string
  addressId: string
  scheduledAt: string // ISO
  paymentProviderCode: string
  urgent: boolean
  contactPhone?: string
  laundryItems?: LaundryItemInput[]
  serviceOptionId?: string
  hours?: number
}

export function createBooking(input: CreateBookingInput): Promise<Booking> {
  return apiRequest<Booking>('POST', '/bookings', { body: input })
}

export function getBooking(id: string): Promise<Booking> {
  return apiRequest<Booking>('GET', `/bookings/${id}`)
}

export function cancelBooking(id: string, reason: string): Promise<void> {
  return apiRequest<void>('POST', `/bookings/${id}/cancel`, { body: { reason } })
}

export function rateBooking(id: string, score: number, comment?: string): Promise<void> {
  return apiRequest<void>('POST', `/bookings/${id}/rating`, {
    body: { score, ...(comment ? { comment } : {}) },
  })
}

// §21.8 — confirmation client d'une révision de prix déclarée par le
// partenaire à l'arrivée. Route servie par le module missions.
export function confirmPriceRevision(bookingId: string, revisionId: string): Promise<void> {
  return apiRequest<void>('POST', `/bookings/${bookingId}/price-revisions/${revisionId}/confirm`)
}

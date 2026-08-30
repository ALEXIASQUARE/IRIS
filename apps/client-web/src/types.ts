// Types de l'API IRIS utiles à l'espace client. Sous-ensemble de
// apps/admin-web/src/types.ts (les champs Decimal Prisma arrivent en chaîne
// -> passer par Number() avant tout calcul / toFixed).

export type BookingStatus =
  | 'DRAFT'
  | 'PENDING_PAYMENT'
  | 'PAID'
  | 'SEARCHING_PARTNER'
  | 'PARTNER_ASSIGNED'
  | 'PARTNER_EN_ROUTE'
  | 'ARRIVED'
  | 'PRICE_REVISION_PENDING'
  | 'IN_PROGRESS'
  | 'COMPLETION_REQUESTED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'DISPUTED'

export interface Country {
  id: string
  isoCode: string
  name: string
  currency: string
  defaultLanguage: string
}

export interface Zone {
  id: string
  name: string
  cityName: string
  centerLat: number
  centerLng: number
  countryId?: string | null
  countryName?: string | null
}

export type PricingUnit = 'FLAT' | 'HOURLY'

export interface ServiceOption {
  id: string
  code: string
  name: string
  basePrice: string | null
  pricingUnit: PricingUnit
  isActive: boolean
}

export interface ServiceCategory {
  id: string
  code: string
  name: string
  isActive: boolean
  options: ServiceOption[]
}

export interface GarmentType {
  id: string
  code: string
  name: string
  basePrice: string
}

export interface CodeName {
  code: string
  name: string
}

export interface QuoteResult {
  currency: string
  subtotal: number
  feesTravel: number
  feesPlatform: number
  urgencySupplement: number
  discount: number
  total: number
  requiresManualQuote: boolean
}

export interface Address {
  id: string
  zoneId: string
  label?: string | null
  landmark: string
  latitude: number
  longitude: number
  isDefault: boolean
}

export interface PriceRevision {
  id: string
  previousTotal: string
  newTotal: string
  reason: string
  confirmedByClientAt?: string | null
}

export interface Booking {
  id: string
  status: BookingStatus
  estimatedTotal: string
  finalTotal?: string | null
  currency: string
  scheduledAt: string
  missionPin?: string | null
  contactPhone?: string | null
  priceRevisions?: PriceRevision[]
  address?: { landmark: string; latitude?: number; longitude?: number }
}

export interface ClientProfile {
  homeZoneId?: string | null
  phone?: string | null
}

export interface NotificationItem {
  id: string
  type: string
  title: string
  body: string
  createdAt: string
}

export const INCIDENT_TYPE_CODES = [
  'OBJET_ENDOMMAGE',
  'RETARD',
  'COMPORTEMENT',
  'PAIEMENT_NON_EFFECTUE',
  'AUTRE',
] as const

export type IncidentSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

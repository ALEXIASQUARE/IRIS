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
  | 'DISPUTED';

export interface Country {
  id: string;
  isoCode: string;
  name: string;
  currency: string;
  defaultLanguage: string;
}

export interface Zone {
  id: string;
  name: string;
  cityName: string;
  centerLat: number;
  centerLng: number;
}

export type PricingUnit = 'FLAT' | 'HOURLY';

export interface ServiceOption {
  id: string;
  code: string;
  name: string;
  basePrice: string | null;
  pricingUnit: PricingUnit;
  isActive: boolean;
}

export interface ServiceCategory {
  id: string;
  countryId: string;
  code: string;
  name: string;
  isActive: boolean;
  options: ServiceOption[];
}

export interface GarmentType {
  id: string;
  code: string;
  name: string;
  basePrice: string;
  isActive: boolean;
}

export interface FabricCategory {
  id: string;
  code: string;
  name: string;
  coefficient: string;
}

export interface StainType {
  id: string;
  code: string;
  name: string;
  surchargeType: 'PERCENT' | 'FIXED' | 'QUOTE';
  surchargeValue: string;
}

export interface QuoteLine {
  [key: string]: unknown;
}

export interface QuoteResult {
  pricingConfigId: string;
  currency: string;
  lines?: QuoteLine[];
  subtotal: number;
  stainSupplements: number;
  feesTravel: number;
  feesPlatform: number;
  urgencySupplement: number;
  discount: number;
  total: number;
  requiresManualQuote: boolean;
}

export interface Address {
  id: string;
  zoneId: string;
  landmark: string;
  latitude: number;
  longitude: number;
  label?: string | null;
  district?: string | null;
  isDefault: boolean;
}

export interface Booking {
  id: string;
  status: BookingStatus;
  // Champs Decimal côté Prisma -- sérialisés en chaîne par JSON.stringify
  // (Decimal.js), jamais en nombre. Toujours passer par Number(...) avant
  // tout calcul ou .toFixed() -- voir AdminBookings.tsx pour le bug que ça
  // a causé (page blanche : TypeError, .toFixed n'existe pas sur une
  // chaîne).
  estimatedTotal: string;
  finalTotal?: string | null;
  currency: string;
  scheduledAt: string;
  missionPin?: string | null;
  address?: { landmark: string };
  assignedPartner?: unknown;
  payment?: unknown;
}

export type IncidentSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type IncidentStatus = 'OPEN' | 'IN_REVIEW' | 'RESOLVED' | 'CLOSED';

// PAIEMENT_NON_EFFECTUE : type dédié — le signaler annule automatiquement
// la mission et libère le partenaire (délai de carence de 30 min après
// l'arrivée, imposé côté backend — voir BookingsService.cancelForNonPayment).
export const INCIDENT_TYPE_CODES = [
  'OBJET_ENDOMMAGE',
  'RETARD',
  'COMPORTEMENT',
  'PAIEMENT_NON_EFFECTUE',
  'AUTRE',
] as const;

export interface Incident {
  id: string;
  bookingId?: string | null;
  type: string;
  severity: IncidentSeverity;
  description: string;
  status: IncidentStatus;
  internalNotes?: string | null;
  createdAt: string;
  resolvedAt?: string | null;
  reporter?: { firstName: string; lastName: string; role: string };
}

export type PartnerStatus = 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';

export interface AdminPartner {
  id: string;
  status: PartnerStatus;
  isAvailable: boolean;
  currentZoneId?: string | null;
  averageRating?: number | null;
  createdAt: string;
  user: { firstName: string; lastName: string; phone: string; email?: string | null };
}

export interface AdminClient {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string | null;
  isBlocked: boolean;
  createdAt: string;
  homeZone?: { cityName: string; name: string } | null;
  _count: { bookingsAsClient: number };
}

export interface AdminBookingListItem {
  id: string;
  status: BookingStatus;
  // Téléphone de contact saisi à la réservation (peut différer du téléphone
  // du compte client).
  contactPhone?: string | null;
  // Decimal Prisma -- voir Booking.estimatedTotal ci-dessus.
  estimatedTotal: string;
  finalTotal?: string | null;
  currency: string;
  scheduledAt: string;
  createdAt: string;
  paymentProviderCode: string;
  client: { firstName: string; lastName: string; phone: string };
  assignedPartner?: { user: { firstName: string; lastName: string; phone: string } } | null;
  payment?: { status: string; provider: string; amount: string; platformCommission: string; partnerPayout: string } | null;
  zone: { cityName: string; name: string };
  serviceCategory: { name: string; code: string };
}

export interface AdminBookingList {
  items: AdminBookingListItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AdminBookingDetail extends AdminBookingListItem {
  cancellationReason?: string | null;
  address: { landmark: string; district?: string | null };
  client: { firstName: string; lastName: string; phone: string; email?: string | null };
  // previousTotal/newTotal : Decimal Prisma -- voir Booking.estimatedTotal.
  priceRevisions: { id: string; previousTotal: string; newTotal: string; reason: string; confirmedByClientAt?: string | null; createdAt: string }[];
  offers: { id: string; status: string; sentAt: string; respondedAt?: string | null; partnerProfile: { user: { firstName: string; lastName: string } } }[];
  incidents: { id: string; type: string; severity: string; status: string; description: string }[];
  rating?: { score: number; comment?: string | null } | null;
}

export interface DashboardData {
  bookingsByStatus: { status: BookingStatus; count: number }[];
  partnersByStatus: { status: PartnerStatus; count: number }[];
  usersByRole: { role: string; count: number }[];
  averageRating: number | null;
  ratingCount: number;
}

export interface AdminCountry {
  id: string;
  isoCode: string;
  name: string;
  currency: string;
  defaultLanguage: string;
  isActive: boolean;
}

export interface AdminZone {
  id: string;
  countryId: string;
  name: string;
  cityName: string;
  centerLat: number;
  centerLng: number;
  radiusMeters: number;
  isActive: boolean;
}

export interface AdminServiceCategory {
  id: string;
  countryId: string;
  code: string;
  name: string;
  isActive: boolean;
}

export interface PricingConfigValues {
  feesTravel: number;
  feesPlatform: number;
  urgencySupplementPercent: number;
  roundingIncrement: number;
}

export interface AdminPricingConfig {
  id: string;
  countryId: string;
  version: number;
  effectiveFrom: string;
  isActive: boolean;
  config: PricingConfigValues;
}

export interface AdminGarmentType {
  id: string;
  code: string;
  name: string;
  basePrice: string;
  isActive: boolean;
}

export interface AdminStainType {
  id: string;
  code: string;
  name: string;
  surchargeType: 'PERCENT' | 'FIXED' | 'QUOTE';
  surchargeValue: string | null;
}

export interface AuditLogEntry {
  id: string;
  action: string;
  targetType: string;
  targetId: string;
  createdAt: string;
  actor: { firstName: string; lastName: string; role: string };
}

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  createdAt: string;
}

export interface PartnerOffer {
  id: string;
  bookingId: string;
  status: string;
  expiresAt: string;
  booking: {
    id: string;
    status: BookingStatus;
    // Decimal Prisma -- voir Booking.estimatedTotal.
    estimatedTotal: string;
    currency: string;
    scheduledAt: string;
    address?: { landmark: string };
  };
}

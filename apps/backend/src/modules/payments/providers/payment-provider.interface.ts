// Interface fournisseur de paiement — §5.5 du Cahier des charges,
// Addendum §5.4. Jamais couplé directement au domaine métier : Booking et
// PaymentTransaction ne connaissent que cette interface, pas MTN/Orange.
export interface InitiatePaymentInput {
  bookingId: string;
  amount: number;
  currency: string;
  phone: string;
}

export interface PaymentResult {
  externalReference: string;
  // Statut immédiat renvoyé par le fournisseur. La confirmation définitive
  // arrive fréquemment de façon asynchrone (webhook) — voir PENDING_CONFIRMATION
  // dans PaymentStatus, Addendum §5.4.
  status: "PENDING" | "PENDING_CONFIRMATION" | "SUCCESS" | "FAILED";
}

export interface PaymentProvider {
  readonly code: string; // "mtn_momo" | "orange_money" | "cash" | "bank_transfer"
  initiate(input: InitiatePaymentInput): Promise<PaymentResult>;
  // Utilisé par le job de réconciliation — Addendum §5.4.
  checkStatus(externalReference: string): Promise<PaymentResult["status"]>;
}

export const PAYMENT_PROVIDER_REGISTRY = "PAYMENT_PROVIDER_REGISTRY";

// Interface fournisseur de notification — même patron que OtpProvider
// (auth/providers/otp-provider.interface.ts) et PaymentProvider. Permet de
// brancher un vrai service push/SMS (Addendum §5.6) sans changer
// NotificationService, qui reste responsable de la persistance en base
// (voir modèle Notification) quel que soit le canal réel utilisé.
export interface NotificationChannel {
  // `critical` distingue les événements qui exigent un repli SMS si le push
  // n'est pas confirmé reçu (offre de mission, révision de prix — Addendum
  // §5.6) des notifications informatives (push uniquement).
  send(userId: string, title: string, body: string, options?: { critical?: boolean }): Promise<void>;
}

export const NOTIFICATION_CHANNEL = 'NOTIFICATION_CHANNEL';

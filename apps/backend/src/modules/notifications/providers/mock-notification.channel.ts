import { Injectable, Logger } from '@nestjs/common';
import { NotificationChannel } from './notification-channel.interface';

// Implémentation de développement : log au lieu d'envoyer un vrai push/SMS.
// À remplacer par un adaptateur réel une fois le fournisseur choisi (§19),
// sans changer NotificationService ni les appelants.
@Injectable()
export class MockNotificationChannel implements NotificationChannel {
  private readonly logger = new Logger('MockNotificationChannel');

  async send(userId: string, title: string, body: string, options?: { critical?: boolean }): Promise<void> {
    const label = options?.critical ? '[PUSH+SMS]' : '[PUSH]';
    this.logger.log(`${label} ${userId} — ${title} : ${body}`);
  }
}

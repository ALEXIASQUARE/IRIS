import { Module } from "@nestjs/common";
import { NotificationService } from "./notification.service";
import { NotificationController } from "./notification.controller";
import { NOTIFICATION_CHANNEL } from "./providers/notification-channel.interface";
import { MockNotificationChannel } from "./providers/mock-notification.channel";

@Module({
  controllers: [NotificationController],
  providers: [
    NotificationService,
    // Adaptateur interchangeable — Addendum §5.6. Remplacer
    // MockNotificationChannel par un adaptateur push/SMS réel une fois le
    // fournisseur choisi (§19), même principe que OTP_PROVIDER.
    { provide: NOTIFICATION_CHANNEL, useClass: MockNotificationChannel },
  ],
  exports: [NotificationService],
})
export class NotificationModule {}

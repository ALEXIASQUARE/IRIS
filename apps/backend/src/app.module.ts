import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD, APP_FILTER } from '@nestjs/core';

import { PrismaModule } from './prisma/prisma.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';

import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { CountriesModule } from './modules/countries/countries.module';
import { ServicesCatalogModule } from './modules/services-catalog/services-catalog.module';
import { PricingModule } from './modules/pricing/pricing.module';
import { BookingsModule } from './modules/bookings/bookings.module';
import { MissionsModule } from './modules/missions/missions.module';
import { PartnersModule } from './modules/partners/partners.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { IncidentsModule } from './modules/incidents/incidents.module';
import { RatingsModule } from './modules/ratings/ratings.module';
import { AdminModule } from './modules/admin/admin.module';
import { AuditModule } from './modules/audit/audit.module';
import { NotificationModule } from './modules/notifications/notification.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(), // requis par OfferExpiryScheduler — Addendum §2.2
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 60 }]), // limite globale par défaut — §13
    PrismaModule,
    NotificationModule,

    AuthModule,
    UsersModule,
    CountriesModule,
    ServicesCatalogModule,
    PricingModule,
    BookingsModule,
    MissionsModule,
    PartnersModule,
    PaymentsModule,
    IncidentsModule,
    RatingsModule,
    AdminModule,
    AuditModule,
  ],
  providers: [
    // Authentification et RBAC appliqués globalement — §13 du Cahier des
    // charges. @Public() sur une route l'exempte de JwtAuthGuard.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}

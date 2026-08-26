import { forwardRef, Module } from '@nestjs/common';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { PricingModule } from '../pricing/pricing.module';
import { PaymentsModule } from '../payments/payments.module';
import { MissionsModule } from '../missions/missions.module';

@Module({
  // forwardRef côté PaymentsModule aussi — voir payments.module.ts.
  imports: [PricingModule, forwardRef(() => PaymentsModule), MissionsModule],
  controllers: [BookingsController],
  providers: [BookingsService],
  exports: [BookingsService],
})
export class BookingsModule {}

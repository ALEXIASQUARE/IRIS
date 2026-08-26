import { Module } from '@nestjs/common';
import { PricingService } from './pricing.service';
import { PricingController } from './pricing.controller';
import { ServicesCatalogModule } from '../services-catalog/services-catalog.module';

@Module({
  imports: [ServicesCatalogModule],
  controllers: [PricingController],
  providers: [PricingService],
  exports: [PricingService],
})
export class PricingModule {}

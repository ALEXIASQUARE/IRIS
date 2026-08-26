import { Body, Controller, Post } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { PricingService } from './pricing.service';
import { GenericQuoteDto, LaundryQuoteDto } from './dto/quote.dto';

// §11 : POST /pricing/quote, §21.11 : POST /pricing/laundry-quote.
// Public : un client doit pouvoir obtenir un devis avant meme de creer un
// compte (parcours de decouverte). Le calcul reste toujours cote serveur --
// jamais de logique tarifaire dans le client mobile (S21.14).
@Public()
@Controller('pricing')
export class PricingController {
  constructor(private pricingService: PricingService) {}

  @Post('quote')
  quote(@Body() dto: GenericQuoteDto) {
    return this.pricingService.computeGenericQuote(dto);
  }

  @Post('laundry-quote')
  laundryQuote(@Body() dto: LaundryQuoteDto) {
    return this.pricingService.computeLaundryQuote(dto);
  }
}

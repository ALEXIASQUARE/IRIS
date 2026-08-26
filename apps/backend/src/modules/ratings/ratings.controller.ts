import { Body, Controller, Param, Post } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RatingsService } from './ratings.service';
import { CreateRatingDto } from './dto/create-rating.dto';

@Controller('bookings')
export class RatingsController {
  constructor(private ratings: RatingsService) {}

  @Roles(UserRole.CLIENT)
  @Post(':bookingId/rating')
  rate(
    @Param('bookingId') bookingId: string,
    @Body() dto: CreateRatingDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.ratings.rateBooking(bookingId, dto, user.id);
  }
}

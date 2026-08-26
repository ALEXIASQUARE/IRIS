import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { BookingsService } from './bookings.service';
import { CreateBookingDto, CancelBookingDto } from './dto/create-booking.dto';

// §11 : POST /bookings, GET /bookings/{id}, POST /bookings/{id}/cancel.
@Controller('bookings')
export class BookingsController {
  constructor(private bookingsService: BookingsService) {}

  @Roles(UserRole.CLIENT)
  @Post()
  create(@Body() dto: CreateBookingDto, @CurrentUser() user: { id: string }) {
    return this.bookingsService.createBooking(dto, user.id);
  }

  @Get(':id')
  getOne(@Param('id') id: string, @CurrentUser() user: { id: string; role: UserRole }) {
    return this.bookingsService.getBooking(id, user.id, user.role);
  }

  @Roles(UserRole.CLIENT)
  @Post(':id/cancel')
  cancel(
    @Param('id') id: string,
    @Body() dto: CancelBookingDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.bookingsService.cancelBooking(id, user.id, dto.reason);
  }

  // Déclenché par le partenaire une fois arrivé — voir bookings.service.ts.
  @Roles(UserRole.PARTNER)
  @Post(':id/request-payment')
  requestPayment(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.bookingsService.requestArrivalPayment(id, user.id);
  }
}

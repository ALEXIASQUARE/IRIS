import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { BookingsService } from './bookings.service';
import { CreateBookingDto, CancelBookingDto, UpdateBookingLocationDto } from './dto/create-booking.dto';

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

  // Le client rafraîchit le point de destination (confirmation quand le
  // partenaire est assigné, ou partage en direct pendant l'approche).
  @Roles(UserRole.CLIENT)
  @Patch(':id/location')
  updateLocation(
    @Param('id') id: string,
    @Body() dto: UpdateBookingLocationDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.bookingsService.updateClientLocation(id, user.id, dto.latitude, dto.longitude);
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

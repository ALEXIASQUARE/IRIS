import { Body, Controller, Get, Post } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PartnersService } from './partners.service';
import { UpsertPartnerProfileDto } from './dto/upsert-partner-profile.dto';
import { SetAvailabilityDto } from './dto/set-availability.dto';
import { UpdateLocationDto } from './dto/update-location.dto';

@Roles(UserRole.PARTNER)
@Controller('partner')
export class PartnersController {
  constructor(private partners: PartnersService) {}

  @Post('profile')
  upsertProfile(@Body() dto: UpsertPartnerProfileDto, @CurrentUser() user: { id: string }) {
    return this.partners.upsertProfile(dto, user.id);
  }

  @Get('profile')
  getProfile(@CurrentUser() user: { id: string }) {
    return this.partners.getProfile(user.id);
  }

  @Post('availability')
  setAvailability(@Body() dto: SetAvailabilityDto, @CurrentUser() user: { id: string }) {
    return this.partners.setAvailability(dto, user.id);
  }

  @Get('offers')
  listOffers(@CurrentUser() user: { id: string }) {
    return this.partners.listOffers(user.id);
  }

  @Post('location')
  updateLocation(@Body() dto: UpdateLocationDto, @CurrentUser() user: { id: string }) {
    return this.partners.updateLocation(dto, user.id);
  }
}

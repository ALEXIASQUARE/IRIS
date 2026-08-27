import { Body, Controller, Get, Patch } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ClientService } from './client.service';
import { UpdateHomeZoneDto } from './dto/update-home-zone.dto';

@Roles(UserRole.CLIENT)
@Controller('client')
export class ClientController {
  constructor(private client: ClientService) {}

  @Get('profile')
  getProfile(@CurrentUser() user: { id: string }) {
    return this.client.getProfile(user.id);
  }

  @Patch('profile')
  updateHomeZone(@Body() dto: UpdateHomeZoneDto, @CurrentUser() user: { id: string }) {
    return this.client.updateHomeZone(user.id, dto.zoneId);
  }
}

import { Body, Controller, Get, Post } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UsersService } from './users.service';
import { CreateAddressDto } from './dto/create-address.dto';

@Controller('addresses')
export class UsersController {
  constructor(private users: UsersService) {}

  @Roles(UserRole.CLIENT)
  @Post()
  create(@Body() dto: CreateAddressDto, @CurrentUser() user: { id: string }) {
    return this.users.createAddress(dto, user.id);
  }

  @Get()
  list(@CurrentUser() user: { id: string }) {
    return this.users.listAddresses(user.id);
  }
}

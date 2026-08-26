import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CountriesService } from '../countries/countries.service';
import { AuditService } from '../audit/audit.service';
import { CreateCountryDto } from './dto/create-country.dto';
import { UpdateCountryDto } from './dto/update-country.dto';
import { CreateZoneDto } from './dto/create-zone.dto';
import { UpdateZoneDto } from './dto/update-zone.dto';

// Gestion admin de la couverture géographique (pays + zones) — Addendum
// technique v1.1 §5.1 : activation progressive pays par pays.
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@Controller('admin')
export class AdminGeoController {
  constructor(
    private countries: CountriesService,
    private audit: AuditService,
  ) {}

  @Get('countries')
  listCountries() {
    return this.countries.listAllCountries();
  }

  @Post('countries')
  async createCountry(@Body() dto: CreateCountryDto, @CurrentUser() user: { id: string }) {
    const created = await this.countries.createCountry(dto);
    await this.audit.log(user.id, 'COUNTRY_CREATED', 'Country', created.id, dto);
    return created;
  }

  @Patch('countries/:id')
  async updateCountry(
    @Param('id') id: string,
    @Body() dto: UpdateCountryDto,
    @CurrentUser() user: { id: string },
  ) {
    const updated = await this.countries.updateCountry(id, dto);
    await this.audit.log(user.id, 'COUNTRY_UPDATED', 'Country', id, dto);
    return updated;
  }

  @Get('countries/:id/zones')
  listZones(@Param('id') id: string) {
    return this.countries.listAllZonesForCountry(id);
  }

  @Post('countries/:id/zones')
  async createZone(
    @Param('id') id: string,
    @Body() dto: CreateZoneDto,
    @CurrentUser() user: { id: string },
  ) {
    const created = await this.countries.createZone(id, dto);
    await this.audit.log(user.id, 'ZONE_CREATED', 'Zone', created.id, dto);
    return created;
  }

  @Patch('zones/:id')
  async updateZone(
    @Param('id') id: string,
    @Body() dto: UpdateZoneDto,
    @CurrentUser() user: { id: string },
  ) {
    const updated = await this.countries.updateZone(id, dto);
    await this.audit.log(user.id, 'ZONE_UPDATED', 'Zone', id, dto);
    return updated;
  }
}

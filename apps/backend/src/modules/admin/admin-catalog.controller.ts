import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CatalogService } from '../services-catalog/catalog.service';
import { AuditService } from '../audit/audit.service';
import { CreateGarmentTypeDto } from './dto/create-garment-type.dto';
import { UpdateGarmentTypeDto } from './dto/update-garment-type.dto';
import { CreateStainTypeDto } from './dto/create-stain-type.dto';
import { UpdateStainTypeDto } from './dto/update-stain-type.dto';

// Gestion admin du catalogue laverie — le client choisit ces valeurs à la
// réservation (ClientBooking), mais leur contenu (prix, coefficients,
// activation) doit rester ajustable sans redéploiement.
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@Controller('admin/catalog')
export class AdminCatalogController {
  constructor(
    private catalog: CatalogService,
    private audit: AuditService,
  ) {}

  @Get('garment-types')
  listGarmentTypes() {
    return this.catalog.listAllGarmentTypes();
  }

  @Post('garment-types')
  async createGarmentType(@Body() dto: CreateGarmentTypeDto, @CurrentUser() user: { id: string }) {
    const created = await this.catalog.createGarmentType(dto);
    await this.audit.log(user.id, 'CATALOG_GARMENT_TYPE_CREATED', 'GarmentType', created.id, dto);
    return created;
  }

  @Patch('garment-types/:id')
  async updateGarmentType(
    @Param('id') id: string,
    @Body() dto: UpdateGarmentTypeDto,
    @CurrentUser() user: { id: string },
  ) {
    const updated = await this.catalog.updateGarmentType(id, dto);
    await this.audit.log(user.id, 'CATALOG_GARMENT_TYPE_UPDATED', 'GarmentType', id, dto);
    return updated;
  }

  @Get('stain-types')
  listStainTypes() {
    return this.catalog.listAllStainTypes();
  }

  @Post('stain-types')
  async createStainType(@Body() dto: CreateStainTypeDto, @CurrentUser() user: { id: string }) {
    const created = await this.catalog.createStainType(dto);
    await this.audit.log(user.id, 'CATALOG_STAIN_TYPE_CREATED', 'StainType', created.id, dto);
    return created;
  }

  @Patch('stain-types/:id')
  async updateStainType(
    @Param('id') id: string,
    @Body() dto: UpdateStainTypeDto,
    @CurrentUser() user: { id: string },
  ) {
    const updated = await this.catalog.updateStainType(id, dto);
    await this.audit.log(user.id, 'CATALOG_STAIN_TYPE_UPDATED', 'StainType', id, dto);
    return updated;
  }
}

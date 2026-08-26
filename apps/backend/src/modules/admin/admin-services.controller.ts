import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CatalogService } from '../services-catalog/catalog.service';
import { PricingService } from '../pricing/pricing.service';
import { AuditService } from '../audit/audit.service';
import { CreateServiceCategoryDto } from './dto/create-service-category.dto';
import { UpdateServiceCategoryDto } from './dto/update-service-category.dto';
import { CreateServiceOptionDto } from './dto/create-service-option.dto';
import { UpdateServiceOptionDto } from './dto/update-service-option.dto';
import { CreatePricingConfigDto } from './dto/create-pricing-config.dto';

// Gestion admin de ce qui rend un pays réellement réservable : catégories
// de service + grille tarifaire (voir aussi AdminGeoController pour
// pays/zones et AdminCatalogController pour le catalogue laverie).
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@Controller('admin')
export class AdminServicesController {
  constructor(
    private catalog: CatalogService,
    private pricing: PricingService,
    private audit: AuditService,
  ) {}

  @Get('countries/:id/service-categories')
  listServiceCategories(@Param('id') id: string) {
    return this.catalog.listAllServiceCategoriesForCountry(id);
  }

  @Post('countries/:id/service-categories')
  async createServiceCategory(
    @Param('id') id: string,
    @Body() dto: CreateServiceCategoryDto,
    @CurrentUser() user: { id: string },
  ) {
    const created = await this.catalog.createServiceCategory(id, dto);
    await this.audit.log(user.id, 'SERVICE_CATEGORY_CREATED', 'ServiceCategory', created.id, dto);
    return created;
  }

  @Patch('service-categories/:id')
  async updateServiceCategory(
    @Param('id') id: string,
    @Body() dto: UpdateServiceCategoryDto,
    @CurrentUser() user: { id: string },
  ) {
    const updated = await this.catalog.updateServiceCategory(id, dto);
    await this.audit.log(user.id, 'SERVICE_CATEGORY_UPDATED', 'ServiceCategory', id, dto);
    return updated;
  }

  @Get('service-categories/:id/options')
  listServiceOptions(@Param('id') id: string) {
    return this.catalog.listServiceOptions(id);
  }

  @Post('service-categories/:id/options')
  async createServiceOption(
    @Param('id') id: string,
    @Body() dto: CreateServiceOptionDto,
    @CurrentUser() user: { id: string },
  ) {
    const created = await this.catalog.createServiceOption(id, dto);
    await this.audit.log(user.id, 'SERVICE_OPTION_CREATED', 'ServiceOption', created.id, dto);
    return created;
  }

  @Patch('service-options/:id')
  async updateServiceOption(
    @Param('id') id: string,
    @Body() dto: UpdateServiceOptionDto,
    @CurrentUser() user: { id: string },
  ) {
    const updated = await this.catalog.updateServiceOption(id, dto);
    await this.audit.log(user.id, 'SERVICE_OPTION_UPDATED', 'ServiceOption', id, dto);
    return updated;
  }

  @Get('countries/:id/pricing-configs')
  listPricingConfigs(@Param('id') id: string) {
    return this.pricing.listPricingConfigs(id);
  }

  @Post('countries/:id/pricing-configs')
  async createPricingConfig(
    @Param('id') id: string,
    @Body() dto: CreatePricingConfigDto,
    @CurrentUser() user: { id: string },
  ) {
    const created = await this.pricing.createPricingConfig(id, dto);
    await this.audit.log(user.id, 'PRICING_CONFIG_CREATED', 'PricingConfig', created.id, dto);
    return created;
  }
}

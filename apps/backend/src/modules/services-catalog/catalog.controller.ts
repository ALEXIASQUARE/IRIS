import { Controller, Get, Param, Query } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { CatalogService } from './catalog.service';

// §11 (GET /services) et §21.11 (catalogue laverie). Lecture seule,
// accessible sans authentification — un client doit pouvoir consulter les
// services et le catalogue avant même de créer un compte.
@Public()
@Controller()
export class CatalogController {
  constructor(private catalog: CatalogService) {}

  @Get('services')
  listServices(@Query('countryId') countryId: string) {
    return this.catalog.listServiceCategories(countryId);
  }

  @Get('laundry/garment-types')
  listGarmentTypes(@Query('countryId') countryId: string) {
    return this.catalog.listGarmentTypes(countryId);
  }

  @Get('laundry/fabric-categories')
  listFabricCategories() {
    return this.catalog.listFabricCategories();
  }

  @Get('laundry/wash-methods')
  listWashMethods() {
    return this.catalog.listWashMethods();
  }

  @Get('laundry/stain-types')
  listStainTypes() {
    return this.catalog.listStainTypes();
  }

  @Get('laundry/packages')
  listPackages(@Query('countryId') countryId: string) {
    return this.catalog.listPackageDeals(countryId);
  }
}

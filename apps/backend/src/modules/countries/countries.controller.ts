import { Controller, Get, Param } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { CountriesService } from './countries.service';

// Lecture seule, publique — un client doit pouvoir choisir son pays/zone
// avant même de créer un compte (même logique que CatalogController).
@Public()
@Controller()
export class CountriesController {
  constructor(private countries: CountriesService) {}

  @Get('countries')
  listCountries() {
    return this.countries.listCountries();
  }

  @Get('countries/:id/zones')
  listZones(@Param('id') id: string) {
    return this.countries.listZones(id);
  }

  @Get('zones/:id')
  getZone(@Param('id') id: string) {
    return this.countries.getZone(id);
  }
}

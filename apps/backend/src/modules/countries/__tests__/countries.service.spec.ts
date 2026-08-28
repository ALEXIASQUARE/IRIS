import { NotFoundException } from '@nestjs/common';
import { CountriesService } from '../countries.service';

// getZone résout une zone par id sans dépendre du pays "prêt" (celui avec
// un catalogue de services actif) — voir PartnerHomeScreen._init côté
// mobile : chercher la zone d'un partenaire dans listZones(country.id) du
// pays "prêt" échouait silencieusement pour tout partenaire enregistré
// dans un pays de test (Belgique/France, zones sans catalogue), retombant
// sur la première zone du pays prêt ("Abang") — et cette valeur erronée
// pouvait ensuite être réécrite en base au premier appel à
// setAvailability.
describe('CountriesService — getZone', () => {
  it('renvoie la zone quel que soit son pays', async () => {
    const prisma = {
      zone: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'zone-be',
          countryId: 'country-be',
          name: 'Centre',
          cityName: 'Libramont-Chevigny',
          isActive: true,
          country: { name: 'Belgique' },
        }),
      },
    };
    const service = new CountriesService(prisma as any);

    const result = await service.getZone('zone-be');

    expect(prisma.zone.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'zone-be' } }),
    );
    expect(result).toEqual(
      expect.objectContaining({ cityName: 'Libramont-Chevigny', name: 'Centre', countryName: 'Belgique' }),
    );
  });

  it("lève NotFoundException si la zone n'existe pas", async () => {
    const prisma = { zone: { findUnique: jest.fn().mockResolvedValue(null) } };
    const service = new CountriesService(prisma as any);

    await expect(service.getZone('missing')).rejects.toThrow(NotFoundException);
  });
});

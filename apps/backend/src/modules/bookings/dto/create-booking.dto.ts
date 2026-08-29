import { IsUUID, IsDateString, IsOptional, IsBoolean, IsArray, ValidateNested, IsIn, IsString, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { LaundryItemDto } from '../../pricing/dto/quote.dto';

// §5.3 du Cahier des charges : choisir service, détails, adresse, date,
// devis, moyen de paiement, confirmer. Ce DTO couvre la confirmation finale ;
// le devis lui-même est obtenu au préalable via /pricing/quote ou
// /pricing/laundry-quote et revalidé côté serveur ici (jamais de prix
// transmis par le client — §21.14).
export class CreateBookingDto {
  @IsUUID()
  serviceCategoryId: string;

  @IsUUID()
  addressId: string;

  @IsDateString()
  scheduledAt: string;

  // Mobile money uniquement — aucun traitement d'espèces entre client et
  // partenaire n'est autorisé sur la plateforme.
  @IsIn(['mtn_momo', 'orange_money'])
  paymentProviderCode: string;

  @IsOptional()
  @IsBoolean()
  urgent?: boolean;

  // Téléphone de contact pour cette réservation (par défaut celui du compte,
  // rempli côté client). Facultatif : si absent, on retombe sur le
  // téléphone du compte — voir BookingsService.create.
  @IsOptional()
  @IsString()
  contactPhone?: string;

  // Présent uniquement pour le service laverie — Mode A (§21.7).
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LaundryItemDto)
  laundryItems?: LaundryItemDto[];

  // Présent pour les services non itemisés (ménage, repassage).
  @IsOptional()
  @IsUUID()
  serviceOptionId?: string;

  // Requis quand l'option choisie est tarifée à l'heure — voir GenericQuoteDto.
  @IsOptional()
  @IsInt()
  @Min(1)
  hours?: number;
}

export class CancelBookingDto {
  @IsString()
  reason: string;
}

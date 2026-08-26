import { IsUUID, IsBoolean, IsOptional, IsArray, ValidateNested, IsInt, Min, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class GenericQuoteDto {
  @IsUUID()
  serviceOptionId: string;

  @IsUUID()
  zoneId: string;

  @IsOptional()
  @IsBoolean()
  urgent?: boolean;

  // Requis quand l'option choisie est tarifée à l'heure (pricingUnit
  // HOURLY) — ex: ménage, repassage à domicile. Ignoré pour une option FLAT.
  @IsOptional()
  @IsInt()
  @Min(1)
  hours?: number;
}

// Un article du panier laverie — §21.7 Mode A (tarification par pièce).
export class LaundryItemDto {
  @IsUUID()
  garmentTypeId: string;

  @IsInt()
  @Min(1)
  quantity: number;

  @IsOptional()
  @IsString()
  fabricCategoryCode?: string; // défaut : STANDARD, §21.4

  @IsOptional()
  @IsString()
  washMethodCode?: string; // défaut : STANDARD, §21.3

  @IsOptional()
  @IsString()
  stainTypeCode?: string; // défaut : NORMAL, §21.5
}

export class LaundryQuoteDto {
  @IsUUID()
  serviceCategoryId: string;

  @IsUUID()
  zoneId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LaundryItemDto)
  items: LaundryItemDto[];

  @IsOptional()
  @IsBoolean()
  urgent?: boolean;
}

import { IsBoolean, IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateServiceOptionDto {
  @IsString()
  code: string;

  @IsString()
  name: string;

  @IsNumber()
  @Min(0)
  basePrice: number;

  // FLAT = prix forfaitaire ; HOURLY = prix par heure (ménage, repassage).
  @IsOptional()
  @IsIn(['FLAT', 'HOURLY'])
  pricingUnit?: 'FLAT' | 'HOURLY';

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

import { IsBoolean, IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class UpdateServiceOptionDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  basePrice?: number;

  @IsOptional()
  @IsIn(['FLAT', 'HOURLY'])
  pricingUnit?: 'FLAT' | 'HOURLY';

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

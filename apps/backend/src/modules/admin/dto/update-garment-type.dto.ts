import { IsBoolean, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';

export class UpdateGarmentTypeDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  basePrice?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

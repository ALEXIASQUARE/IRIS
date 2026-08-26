import { IsNumber, IsOptional, IsPositive, IsString, IsUUID } from 'class-validator';

export class CreateGarmentTypeDto {
  @IsString()
  code: string;

  @IsString()
  name: string;

  @IsNumber()
  @IsPositive()
  basePrice: number;

  @IsOptional()
  @IsUUID()
  countryId?: string;
}

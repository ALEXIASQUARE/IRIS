import { IsUUID, IsString, IsOptional, IsNumber, IsBoolean } from 'class-validator';

export class CreateAddressDto {
  @IsUUID()
  zoneId: string;

  @IsString()
  landmark: string;

  @IsNumber()
  latitude: number;

  @IsNumber()
  longitude: number;

  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsString()
  district?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpdateZoneDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  cityName?: string;

  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  centerLat?: number;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  centerLng?: number;

  @IsOptional()
  @IsInt()
  radiusMeters?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

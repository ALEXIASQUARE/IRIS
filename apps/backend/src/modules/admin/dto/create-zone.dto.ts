import { IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateZoneDto {
  @IsString()
  name: string;

  @IsString()
  cityName: string;

  @IsNumber()
  @Min(-90)
  @Max(90)
  centerLat: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  centerLng: number;

  @IsOptional()
  @IsInt()
  radiusMeters?: number;
}

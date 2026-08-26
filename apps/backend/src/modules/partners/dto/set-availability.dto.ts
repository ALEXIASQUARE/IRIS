import { IsBoolean, IsOptional, IsUUID } from 'class-validator';

export class SetAvailabilityDto {
  @IsBoolean()
  isAvailable: boolean;

  @IsOptional()
  @IsUUID()
  currentZoneId?: string;
}

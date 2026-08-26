import { IsUUID, IsOptional, IsString } from 'class-validator';

export class UpsertPartnerProfileDto {
  @IsUUID()
  currentZoneId: string;

  @IsOptional()
  @IsString()
  emergencyContact?: string;
}

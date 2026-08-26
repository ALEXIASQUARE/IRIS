import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { IncidentSeverity } from '@prisma/client';

export class CreateIncidentDto {
  @IsOptional()
  @IsUUID()
  bookingId?: string;

  @IsString()
  type: string;

  @IsOptional()
  @IsEnum(IncidentSeverity)
  severity?: IncidentSeverity;

  @IsString()
  description: string;
}

import { IsUUID } from 'class-validator';

export class UpdateHomeZoneDto {
  @IsUUID()
  zoneId: string;
}

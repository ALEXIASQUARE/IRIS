import { IsUUID, IsString, IsOptional, IsNumber, IsBoolean } from 'class-validator';

export class CreateAddressDto {
  @IsUUID()
  zoneId: string;

  // Nom donné par le client pour retrouver l'adresse (« Maison de ma
  // mère »). Exigé par les nouvelles UIs ; laissé optionnel ici pour ne
  // pas casser les clients mobiles pas encore mis à jour (le service
  // retombe sur `landmark`).
  @IsOptional()
  @IsString()
  label?: string;

  @IsString()
  landmark: string;

  @IsNumber()
  latitude: number;

  @IsNumber()
  longitude: number;

  @IsOptional()
  @IsString()
  district?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

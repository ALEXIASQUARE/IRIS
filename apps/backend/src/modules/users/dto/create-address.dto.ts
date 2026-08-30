import { IsUUID, IsString, IsOptional, IsNumber, IsBoolean, IsNotEmpty } from 'class-validator';

export class CreateAddressDto {
  @IsUUID()
  zoneId: string;

  // Nom donné par le client pour retrouver l'adresse (« Maison de ma
  // mère ») — obligatoire, sert de libellé dans la liste des adresses.
  @IsString()
  @IsNotEmpty()
  label: string;

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

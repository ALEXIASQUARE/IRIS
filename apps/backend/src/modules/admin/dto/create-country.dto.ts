import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class CreateCountryDto {
  @IsString()
  isoCode: string;

  @IsString()
  name: string;

  @IsString()
  currency: string;

  @IsString()
  defaultLanguage: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateCountryDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  defaultLanguage?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

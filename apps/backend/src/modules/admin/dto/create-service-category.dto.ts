import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class CreateServiceCategoryDto {
  @IsString()
  code: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

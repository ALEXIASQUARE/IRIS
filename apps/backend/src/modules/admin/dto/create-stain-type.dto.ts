import { IsIn, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateStainTypeDto {
  @IsString()
  code: string;

  @IsString()
  name: string;

  @IsIn(['PERCENT', 'FIXED', 'QUOTE'])
  surchargeType: string;

  @IsOptional()
  @IsNumber()
  surchargeValue?: number;
}

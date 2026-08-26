import { IsIn, IsNumber, IsOptional, IsString } from 'class-validator';

export class UpdateStainTypeDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsIn(['PERCENT', 'FIXED', 'QUOTE'])
  surchargeType?: string;

  @IsOptional()
  @IsNumber()
  surchargeValue?: number;
}

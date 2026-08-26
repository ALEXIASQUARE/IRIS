import { IsNumber, Min } from 'class-validator';

export class CreatePricingConfigDto {
  @IsNumber()
  @Min(0)
  feesTravel: number;

  @IsNumber()
  @Min(0)
  feesPlatform: number;

  @IsNumber()
  @Min(0)
  urgencySupplementPercent: number;

  @IsNumber()
  @Min(0)
  roundingIncrement: number;
}

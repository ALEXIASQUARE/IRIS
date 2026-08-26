import { IsNumber, IsString, IsOptional, IsObject } from "class-validator";

// §21.8 — le partenaire déclare un écart constaté à l'arrivée.
export class CreatePriceRevisionDto {
  @IsNumber()
  newTotal: number;

  @IsString()
  reason: string;

  @IsOptional()
  @IsObject()
  detail?: Record<string, unknown>;
}

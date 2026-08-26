import { IsString, Length } from "class-validator";

export class VerifyOtpDto {
  @IsString()
  phone: string;

  @Length(4, 6)
  code: string;
}

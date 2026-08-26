import { IsString, Length } from "class-validator";

export class StartMissionDto {
  @IsString()
  @Length(4, 6)
  pin: string;
}

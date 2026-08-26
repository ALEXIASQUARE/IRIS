import { IsString, Length, Matches, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @Matches(/^\+?[0-9]{8,15}$/, { message: 'Numéro de téléphone invalide.' })
  phone: string;

  @Length(4, 6)
  code: string;

  @IsString()
  @MinLength(8, { message: 'Le nouveau mot de passe doit contenir au moins 8 caractères.' })
  newPassword: string;
}

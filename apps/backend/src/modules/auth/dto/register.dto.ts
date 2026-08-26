import { IsString, IsOptional, IsEmail, MinLength, Matches, IsIn } from "class-validator";
import { UserRole } from "@prisma/client";

// §5.1 du Cahier des charges — inscription client.
export class RegisterDto {
  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @Matches(/^\+?[0-9]{8,15}$/, { message: "Numéro de téléphone invalide." })
  phone: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @MinLength(8, { message: "Le mot de passe doit contenir au moins 8 caractères." })
  password: string;

  @IsString()
  countryCode: string; // ISO du pays — Addendum §5.1

  // Optionnel, défaut CLIENT. Permet de créer des comptes partenaire/admin
  // pour les besoins de test tant que les onboardings dédiés n'existent pas.
  @IsOptional()
  @IsIn([UserRole.CLIENT, UserRole.PARTNER, UserRole.ADMIN])
  role?: UserRole;
}

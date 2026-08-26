import { SetMetadata } from "@nestjs/common";

export const IS_PUBLIC_KEY = "isPublic";

// Marque un endpoint comme accessible sans authentification
// (ex: /auth/register, /auth/verify-otp, /auth/login).
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

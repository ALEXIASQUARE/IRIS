import { SetMetadata } from "@nestjs/common";
import { UserRole } from "@prisma/client";

export const ROLES_KEY = "roles";

// Usage : @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
// Référence : §4 (Rôles et autorisations), §13 (RBAC strict) du Cahier des charges.
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

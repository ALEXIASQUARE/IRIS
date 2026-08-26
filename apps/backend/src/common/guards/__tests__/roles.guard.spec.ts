import { ForbiddenException, ExecutionContext } from '@nestjs/common';
import { RolesGuard } from '../roles.guard';
import { UserRole } from '@prisma/client';

// RBAC strict — §13 du Cahier des charges. Mentionné comme manquant dans
// le README ("reste à couvrir permissions").

function buildContext(user: { role: UserRole } | undefined): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

function buildReflector(requiredRoles: UserRole[] | undefined) {
  return { getAllAndOverride: jest.fn().mockReturnValue(requiredRoles) };
}

describe('RolesGuard', () => {
  it("laisse passer une route sans rôle requis, même sans utilisateur authentifié", () => {
    const reflector = buildReflector(undefined);
    const guard = new RolesGuard(reflector as any);

    expect(guard.canActivate(buildContext(undefined))).toBe(true);
  });

  it('laisse passer un utilisateur dont le rôle figure dans la liste requise', () => {
    const reflector = buildReflector([UserRole.ADMIN, UserRole.SUPER_ADMIN]);
    const guard = new RolesGuard(reflector as any);

    expect(guard.canActivate(buildContext({ role: UserRole.ADMIN }))).toBe(true);
  });

  it("refuse un utilisateur dont le rôle ne figure pas dans la liste requise", () => {
    const reflector = buildReflector([UserRole.ADMIN, UserRole.SUPER_ADMIN]);
    const guard = new RolesGuard(reflector as any);

    expect(() => guard.canActivate(buildContext({ role: UserRole.CLIENT }))).toThrow(ForbiddenException);
  });

  it("refuse une route protégée par rôle quand aucun utilisateur n'est présent sur la requête", () => {
    const reflector = buildReflector([UserRole.ADMIN]);
    const guard = new RolesGuard(reflector as any);

    expect(() => guard.canActivate(buildContext(undefined))).toThrow(ForbiddenException);
  });

  it('refuse un partenaire sur une route réservée aux clients', () => {
    const reflector = buildReflector([UserRole.CLIENT]);
    const guard = new RolesGuard(reflector as any);

    expect(() => guard.canActivate(buildContext({ role: UserRole.PARTNER }))).toThrow(ForbiddenException);
  });
});

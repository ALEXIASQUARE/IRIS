import { ExecutionContext } from '@nestjs/common';
import { JwtAuthGuard } from '../jwt-auth.guard';

// Vérifie uniquement la logique propre à ce guard (le court-circuit
// @Public()) — la validation du token elle-même est déléguée à
// AuthGuard('jwt')/passport-jwt, hors périmètre d'un test unitaire.

function buildContext(): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => ({}), getResponse: () => ({}) }),
  } as unknown as ExecutionContext;
}

describe('JwtAuthGuard', () => {
  it('laisse passer sans vérifier le token quand la route est marquée @Public()', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(true) };
    const guard = new JwtAuthGuard(reflector as any);

    const superCanActivate = jest.spyOn(
      Object.getPrototypeOf(JwtAuthGuard.prototype),
      'canActivate',
    );

    expect(guard.canActivate(buildContext())).toBe(true);
    expect(superCanActivate).not.toHaveBeenCalled();

    superCanActivate.mockRestore();
  });

  it('délègue à la vérification JWT standard quand la route n’est pas publique', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) };
    const guard = new JwtAuthGuard(reflector as any);

    const superCanActivate = jest
      .spyOn(Object.getPrototypeOf(JwtAuthGuard.prototype), 'canActivate')
      .mockReturnValue(true as any);

    const result = guard.canActivate(buildContext());

    expect(superCanActivate).toHaveBeenCalled();
    expect(result).toBe(true);

    superCanActivate.mockRestore();
  });
});

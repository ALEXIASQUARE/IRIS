import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../auth.service';

// Couvre le correctif : le refresh token était émis (issueTokens) mais
// aucune route ne l'acceptait — un token d'accès expiré (15 min) bloquait
// la session sans recours (voir aussi §13 : secrets distincts pour access
// et refresh token).

function buildDeps(overrides: Partial<Record<string, any>> = {}) {
  const prisma = {
    user: {
      findUnique: jest.fn().mockResolvedValue({ id: 'user-1', role: 'CLIENT', isBlocked: false }),
      ...overrides.prisma?.user,
    },
  };
  const jwt = {
    verifyAsync: jest.fn().mockResolvedValue({ sub: 'user-1', role: 'CLIENT' }),
    signAsync: jest.fn().mockResolvedValue('signed-token'),
    ...overrides.jwt,
  };
  const config = { get: jest.fn().mockReturnValue('refresh-secret') };
  const otpProvider = { sendOtp: jest.fn() };
  return { prisma, jwt, config, otpProvider };
}

describe('AuthService — refresh', () => {
  it('émet de nouveaux tokens quand le refresh token est valide', async () => {
    const { prisma, jwt, config, otpProvider } = buildDeps();
    const service = new AuthService(prisma as any, jwt as any, config as any, otpProvider as any);

    const result = await service.refresh('valid-refresh-token');

    expect(jwt.verifyAsync).toHaveBeenCalledWith('valid-refresh-token', { secret: 'refresh-secret' });
    expect(result).toEqual({ accessToken: 'signed-token', refreshToken: 'signed-token' });
  });

  it('vérifie le refresh token avec un secret distinct de celui utilisé à la connexion', async () => {
    const { prisma, jwt, config, otpProvider } = buildDeps();
    const service = new AuthService(prisma as any, jwt as any, config as any, otpProvider as any);

    await service.refresh('token');

    expect(config.get).toHaveBeenCalledWith('JWT_REFRESH_SECRET');
  });

  it('lève UnauthorizedException si le refresh token est invalide ou expiré', async () => {
    const { prisma, jwt, config, otpProvider } = buildDeps({
      jwt: { verifyAsync: jest.fn().mockRejectedValue(new Error('jwt expired')) },
    });
    const service = new AuthService(prisma as any, jwt as any, config as any, otpProvider as any);

    await expect(service.refresh('expired-token')).rejects.toThrow(UnauthorizedException);
  });

  it("lève UnauthorizedException si l'utilisateur associé n'existe plus", async () => {
    const { prisma, jwt, config, otpProvider } = buildDeps({
      prisma: { user: { findUnique: jest.fn().mockResolvedValue(null) } },
    });
    const service = new AuthService(prisma as any, jwt as any, config as any, otpProvider as any);

    await expect(service.refresh('token')).rejects.toThrow(UnauthorizedException);
  });

  it('lève UnauthorizedException si le compte est bloqué', async () => {
    const { prisma, jwt, config, otpProvider } = buildDeps({
      prisma: { user: { findUnique: jest.fn().mockResolvedValue({ id: 'user-1', role: 'CLIENT', isBlocked: true }) } },
    });
    const service = new AuthService(prisma as any, jwt as any, config as any, otpProvider as any);

    await expect(service.refresh('token')).rejects.toThrow(UnauthorizedException);
  });
});

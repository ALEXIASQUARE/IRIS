import { BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { AuthService } from '../auth.service';

jest.mock('argon2', () => ({
  hash: jest.fn().mockResolvedValue('new-hash'),
  verify: jest.fn(),
}));

// Couvre le correctif : le refresh token était émis (issueTokens) mais
// aucune route ne l'acceptait — un token d'accès expiré (15 min) bloquait
// la session sans recours (voir aussi §13 : secrets distincts pour access
// et refresh token).

function buildDeps(overrides: Partial<Record<string, any>> = {}) {
  const prisma: any = {
    user: {
      findUnique: jest.fn().mockResolvedValue({ id: 'user-1', role: 'CLIENT', isBlocked: false, passwordHash: 'old-hash' }),
      update: jest.fn().mockResolvedValue({ id: 'user-1' }),
      create: jest.fn().mockResolvedValue({ id: 'user-1', role: 'CLIENT' }),
      ...overrides.prisma?.user,
    },
    country: {
      findUnique: jest.fn().mockResolvedValue({ id: 'country-1', isActive: true, defaultLanguage: 'fr' }),
      ...overrides.prisma?.country,
    },
    zone: {
      findUnique: jest.fn().mockResolvedValue({ id: 'zone-1', isActive: true }),
      ...overrides.prisma?.zone,
    },
    partnerProfile: {
      create: jest.fn().mockResolvedValue({ id: 'profile-1' }),
      ...overrides.prisma?.partnerProfile,
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

// Ajouté après un test terrain (Dschang) : un partenaire n'avait aucun moyen
// de changer son mot de passe une fois le compte créé.
describe('AuthService — changePassword', () => {
  beforeEach(() => {
    (argon2.verify as jest.Mock).mockReset();
    (argon2.hash as jest.Mock).mockClear();
  });

  it('met à jour le hash quand le mot de passe actuel est correct', async () => {
    (argon2.verify as jest.Mock).mockResolvedValue(true);
    const { prisma, jwt, config, otpProvider } = buildDeps();
    const service = new AuthService(prisma as any, jwt as any, config as any, otpProvider as any);

    await service.changePassword('user-1', 'currentPass1', 'newPassword1');

    expect(argon2.verify).toHaveBeenCalledWith('old-hash', 'currentPass1');
    expect(argon2.hash).toHaveBeenCalledWith('newPassword1');
    expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: 'user-1' }, data: { passwordHash: 'new-hash' } });
  });

  it('lève UnauthorizedException si le mot de passe actuel est incorrect', async () => {
    (argon2.verify as jest.Mock).mockResolvedValue(false);
    const { prisma, jwt, config, otpProvider } = buildDeps();
    const service = new AuthService(prisma as any, jwt as any, config as any, otpProvider as any);

    await expect(service.changePassword('user-1', 'wrong', 'newPassword1')).rejects.toThrow(UnauthorizedException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("lève NotFoundException si l'utilisateur n'existe plus", async () => {
    const { prisma, jwt, config, otpProvider } = buildDeps({
      prisma: { user: { findUnique: jest.fn().mockResolvedValue(null) } },
    });
    const service = new AuthService(prisma as any, jwt as any, config as any, otpProvider as any);

    await expect(service.changePassword('user-1', 'currentPass1', 'newPassword1')).rejects.toThrow(NotFoundException);
  });
});

// Ajouté suite au retour terrain (Dschang) : la ville/le quartier du
// partenaire n'étaient jamais demandés à l'inscription.
describe('AuthService — register (zone partenaire)', () => {
  const registerDto = {
    firstName: 'Jean',
    lastName: 'Kamdem',
    phone: '+237600000001',
    password: 'password123',
    countryCode: 'CM',
    role: 'PARTNER' as const,
    zoneId: 'zone-1',
  };

  it('crée un PartnerProfile avec la zone choisie quand role=PARTNER et zoneId fourni', async () => {
    const { prisma, jwt, config, otpProvider } = buildDeps({
      prisma: { user: { findUnique: jest.fn().mockResolvedValue(null) } },
    });
    const service = new AuthService(prisma as any, jwt as any, config as any, otpProvider as any);

    await service.register(registerDto as any);

    expect(prisma.zone.findUnique).toHaveBeenCalledWith({ where: { id: 'zone-1' } });
    expect(prisma.partnerProfile.create).toHaveBeenCalledWith({
      data: { userId: 'user-1', currentZoneId: 'zone-1' },
    });
  });

  it('ignore zoneId si le rôle est CLIENT', async () => {
    const { prisma, jwt, config, otpProvider } = buildDeps({
      prisma: { user: { findUnique: jest.fn().mockResolvedValue(null) } },
    });
    const service = new AuthService(prisma as any, jwt as any, config as any, otpProvider as any);

    await service.register({ ...registerDto, role: 'CLIENT' as any });

    expect(prisma.partnerProfile.create).not.toHaveBeenCalled();
  });

  it('lève BadRequestException si la zone est introuvable ou inactive', async () => {
    const { prisma, jwt, config, otpProvider } = buildDeps({
      prisma: {
        user: { findUnique: jest.fn().mockResolvedValue(null) },
        zone: { findUnique: jest.fn().mockResolvedValue(null) },
      },
    });
    const service = new AuthService(prisma as any, jwt as any, config as any, otpProvider as any);

    await expect(service.register(registerDto as any)).rejects.toThrow(BadRequestException);
    expect(prisma.user.create).not.toHaveBeenCalled();
  });
});

// Demandé par l'utilisateur : mot de passe oublié avec code reçu par SMS,
// qui ouvre directement la session en cas de succès (preuve de possession
// du téléphone).
describe('AuthService — mot de passe oublié', () => {
  it('lève NotFoundException si aucun compte pour ce numéro (requestPasswordReset)', async () => {
    const { prisma, jwt, config, otpProvider } = buildDeps({
      prisma: { user: { findUnique: jest.fn().mockResolvedValue(null) } },
    });
    const service = new AuthService(prisma as any, jwt as any, config as any, otpProvider as any);

    await expect(service.requestPasswordReset('+237600000001')).rejects.toThrow(NotFoundException);
  });

  it('met à jour le mot de passe et ouvre la session quand le code est correct', async () => {
    const { prisma, jwt, config, otpProvider } = buildDeps();
    const service = new AuthService(prisma as any, jwt as any, config as any, otpProvider as any);

    process.env.OTP_PROVIDER = 'mock';
    const { devOtp } = await service.requestPasswordReset('+237600000001');
    const result = await service.resetPassword('+237600000001', devOtp!, 'newPassword1');

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { passwordHash: 'new-hash', phoneVerifiedAt: expect.any(Date) },
    });
    expect(result).toEqual({ accessToken: 'signed-token', refreshToken: 'signed-token' });
  });

  it('lève BadRequestException si le code est incorrect', async () => {
    const { prisma, jwt, config, otpProvider } = buildDeps();
    const service = new AuthService(prisma as any, jwt as any, config as any, otpProvider as any);

    process.env.OTP_PROVIDER = 'mock';
    await service.requestPasswordReset('+237600000001');

    await expect(service.resetPassword('+237600000001', '000000', 'newPassword1')).rejects.toThrow(
      BadRequestException,
    );
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});

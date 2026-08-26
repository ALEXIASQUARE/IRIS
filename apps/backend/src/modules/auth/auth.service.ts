import { Injectable, ConflictException, UnauthorizedException, BadRequestException, NotFoundException, Inject } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { PrismaService } from '../../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { LoginDto } from './dto/login.dto';
import { OtpProvider, OTP_PROVIDER } from './providers/otp-provider.interface';

// Stockage en mémoire des codes OTP pour le MVP.
// À remplacer par Redis (avec TTL natif) dès que le backend tourne en
// plusieurs instances — un Map en mémoire de process ne survit pas à un
// redémarrage ni ne se partage entre instances.
interface PendingOtp {
  code: string;
  expiresAt: Date;
  attempts: number;
}

@Injectable()
export class AuthService {
  private otpStore = new Map<string, PendingOtp>();

  private readonly OTP_TTL_MINUTES = 5;
  private readonly OTP_MAX_ATTEMPTS = 5;

  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
    @Inject(OTP_PROVIDER) private otpProvider: OtpProvider,
  ) {}

  // §5.1 — Inscription : le compte est créé immédiatement mais reste non
  // vérifié (phoneVerifiedAt = null) tant que l'OTP n'est pas confirmé.
  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({ where: { phone: dto.phone } });
    if (existing) {
      throw new ConflictException('Un compte existe déjà avec ce numéro de téléphone.');
    }

    const country = await this.prisma.country.findUnique({ where: { isoCode: dto.countryCode } });
    if (!country || !country.isActive) {
      throw new BadRequestException('Pays non pris en charge pour le moment.');
    }

    const passwordHash = await argon2.hash(dto.password);

    const user = await this.prisma.user.create({
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        email: dto.email,
        passwordHash,
        countryId: country.id,
        preferredLanguage: country.defaultLanguage,
        role: dto.role ?? undefined, // undefined -> défaut Prisma (CLIENT)
      },
    });

    const code = await this.issueOtp(dto.phone);

    // Le fournisseur OTP mock ne fait que logger le code côté serveur — en
    // dev, on le renvoie aussi dans la réponse pour permettre de tester
    // sans accès aux logs. Ne jamais faire ça avec un vrai fournisseur.
    const devOtp = process.env.OTP_PROVIDER === 'mock' ? code : undefined;

    return {
      userId: user.id,
      message: 'Compte créé. Un code de vérification a été envoyé.',
      ...(devOtp ? { devOtp } : {}),
    };
  }

  // Génération et envoi d'un OTP — réutilisé par register() et par une
  // future route de renvoi de code. Retourne le code généré (utile en dev).
  private async issueOtp(phone: string): Promise<string> {
    const code = String(Math.floor(100000 + Math.random() * 900000)); // 6 chiffres
    const expiresAt = new Date(Date.now() + this.OTP_TTL_MINUTES * 60 * 1000);
    this.otpStore.set(phone, { code, expiresAt, attempts: 0 });
    await this.otpProvider.sendOtp(phone, code);
    return code;
  }

  // §5.1 étape 2 — Vérification OTP. Le PIN de mission suit une logique
  // similaire mais distincte (voir MissionsService) : ne pas confondre les deux.
  async verifyOtp(dto: VerifyOtpDto) {
    const pending = this.otpStore.get(dto.phone);
    if (!pending) {
      throw new BadRequestException("Aucun code en attente pour ce numéro.");
    }
    if (pending.expiresAt < new Date()) {
      this.otpStore.delete(dto.phone);
      throw new BadRequestException('Code expiré. Veuillez en demander un nouveau.');
    }
    if (pending.attempts >= this.OTP_MAX_ATTEMPTS) {
      this.otpStore.delete(dto.phone);
      throw new BadRequestException('Trop de tentatives. Veuillez demander un nouveau code.');
    }
    if (pending.code !== dto.code) {
      pending.attempts += 1;
      throw new BadRequestException('Code incorrect.');
    }

    this.otpStore.delete(dto.phone);

    const user = await this.prisma.user.update({
      where: { phone: dto.phone },
      data: { phoneVerifiedAt: new Date() },
    });

    return this.issueTokens(user.id, user.role);
  }

  // §13 — jamais de mot de passe en clair ; hash Argon2.
  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { phone: dto.phone } });
    if (!user) {
      throw new UnauthorizedException('Identifiants invalides.');
    }
    if (!user.phoneVerifiedAt) {
      throw new UnauthorizedException('Numéro de téléphone non vérifié.');
    }
    if (user.isBlocked) {
      throw new UnauthorizedException('Ce compte est bloqué.');
    }

    const valid = await argon2.verify(user.passwordHash, dto.password);
    if (!valid) {
      throw new UnauthorizedException('Identifiants invalides.');
    }

    return this.issueTokens(user.id, user.role);
  }

  // Tokens courts + refresh token — §13 du Cahier des charges. Le refresh
  // token est signé avec un secret distinct (JWT_REFRESH_SECRET) : un accès
  // token compromis ne doit pas permettre de forger un refresh token, et
  // inversement.
  private async issueTokens(userId: string, role: string) {
    const payload = { sub: userId, role };
    const accessToken = await this.jwt.signAsync(payload, { expiresIn: '15m' });
    const refreshToken = await this.jwt.signAsync(payload, {
      secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: '30d',
    });
    return { accessToken, refreshToken };
  }

  // Corrige un manque : le refresh token était émis mais jamais utilisable
  // (aucune route ne l'acceptait) — un token d'accès expiré (15 min)
  // bloquait la session sans recours, obligeant à se reconnecter à la main.
  async refresh(refreshToken: string) {
    let payload: { sub: string; role: string };
    try {
      payload = await this.jwt.verifyAsync(refreshToken, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Refresh token invalide ou expiré.');
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || user.isBlocked) {
      throw new UnauthorizedException('Compte introuvable ou bloqué.');
    }

    return this.issueTokens(user.id, user.role);
  }

  // Demandé après un test terrain (Dschang) : un partenaire n'avait aucun
  // moyen de changer son mot de passe une fois le compte créé. Exige le mot
  // de passe actuel (comme pour toute route de changement de mot de passe)
  // même si la session est déjà authentifiée, pour éviter qu'un accès
  // temporaire au téléphone déverrouillé ne suffise à prendre le compte.
  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Utilisateur introuvable.');
    }

    const valid = await argon2.verify(user.passwordHash, currentPassword);
    if (!valid) {
      throw new UnauthorizedException('Mot de passe actuel incorrect.');
    }

    const passwordHash = await argon2.hash(newPassword);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
  }
}

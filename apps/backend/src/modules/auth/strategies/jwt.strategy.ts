import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../../prisma/prisma.service";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService, private prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>("JWT_ACCESS_SECRET"),
    });
  }

  // Le payload est réduit au strict nécessaire ; on revalide l'existence et
  // le statut de l'utilisateur à chaque requête plutôt que de faire confiance
  // aveuglément au contenu du token.
  async validate(payload: { sub: string }) {
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || user.isBlocked) {
      return null;
    }
    return { id: user.id, role: user.role, countryId: user.countryId, phone: user.phone };
  }
}

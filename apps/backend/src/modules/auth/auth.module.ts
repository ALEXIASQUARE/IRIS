import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { JwtStrategy } from "./strategies/jwt.strategy";
import { OTP_PROVIDER } from "./providers/otp-provider.interface";
import { MockOtpProvider } from "./providers/mock-otp.provider";

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>("JWT_ACCESS_SECRET"),
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    // Adaptateur interchangeable — Addendum §5.3. Remplacer MockOtpProvider
    // par un adaptateur SMS/vocal/USSD réel une fois le fournisseur choisi (§19).
    { provide: OTP_PROVIDER, useClass: MockOtpProvider },
  ],
  exports: [AuthService],
})
export class AuthModule {}

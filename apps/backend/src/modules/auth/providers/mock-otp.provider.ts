import { Injectable, Logger } from "@nestjs/common";
import { OtpProvider } from "./otp-provider.interface";

// Implémentation de développement : log le code au lieu de l'envoyer.
// À remplacer par un adaptateur SMS réel (voir §19 — fournisseur non choisi).
@Injectable()
export class MockOtpProvider implements OtpProvider {
  private readonly logger = new Logger("MockOtpProvider");

  async sendOtp(phone: string, code: string): Promise<void> {
    this.logger.log(`[DEV] OTP pour ${phone} : ${code}`);
  }
}

// Interface fournisseur OTP — Addendum technique v1.1 §5.3.
// Un seul canal peut être branché au lancement, mais l'abstraction doit
// exister dès le MVP pour permettre une bascule SMS -> appel vocal -> USSD
// sans changement de code métier.
export interface OtpProvider {
  sendOtp(phone: string, code: string): Promise<void>;
}

export const OTP_PROVIDER = "OTP_PROVIDER";

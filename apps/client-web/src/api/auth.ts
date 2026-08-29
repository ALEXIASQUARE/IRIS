// Appels typés vers /auth/* — voir apps/backend/src/modules/auth.
import { apiRequest } from './client'
import type { TokenPair } from '../auth/tokens'

export interface RegisterInput {
  firstName: string
  lastName: string
  phone: string
  password: string
  countryCode: string
  email?: string
}

export interface RegisterResult {
  userId: string
  message: string
  devOtp?: string // uniquement en dev (OTP_PROVIDER=mock)
}

export function register(input: RegisterInput): Promise<RegisterResult> {
  return apiRequest<RegisterResult>('POST', '/auth/register', { auth: false, body: input })
}

export function verifyOtp(phone: string, code: string): Promise<TokenPair> {
  return apiRequest<TokenPair>('POST', '/auth/verify-otp', { auth: false, body: { phone, code } })
}

export function login(phone: string, password: string): Promise<TokenPair> {
  return apiRequest<TokenPair>('POST', '/auth/login', { auth: false, body: { phone, password } })
}

export interface PasswordResetRequestResult {
  message: string
  devOtp?: string
}

export function requestPasswordReset(phone: string): Promise<PasswordResetRequestResult> {
  return apiRequest<PasswordResetRequestResult>('POST', '/auth/password-reset/request', {
    auth: false,
    body: { phone },
  })
}

export function confirmPasswordReset(
  phone: string,
  code: string,
  newPassword: string,
): Promise<TokenPair> {
  return apiRequest<TokenPair>('POST', '/auth/password-reset/confirm', {
    auth: false,
    body: { phone, code, newPassword },
  })
}

export function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  return apiRequest<void>('PATCH', '/auth/password', {
    body: { currentPassword, newPassword },
  })
}

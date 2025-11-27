import speakeasy from 'speakeasy';
import QRCode from 'qrcode';

/**
 * Generate 2FA secret for Google Authenticator
 */
export const generate2FASecret = (email: string): { secret: string; otpauth_url: string } => {
  const secret = speakeasy.generateSecret({
    name: `Plagiarism Checker (${email})`,
    issuer: 'Plagiarism Checker Service',
  });

  return {
    secret: secret.base32,
    otpauth_url: secret.otpauth_url || '',
  };
};

/**
 * Generate QR code from otpauth URL
 */
export const generateQRCode = async (otpauth_url: string): Promise<string> => {
  return await QRCode.toDataURL(otpauth_url);
};

/**
 * Verify 2FA token
 */
export const verify2FAToken = (token: string, secret: string): boolean => {
  return speakeasy.totp.verify({
    secret: secret,
    encoding: 'base32',
    token: token,
    window: 2, // Allow 2 time steps before and after
  });
};

/**
 * Generate 6-digit email OTP
 */
export const generateEmailOTP = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Verify email OTP
 */
export const verifyEmailOTP = (inputOTP: string, storedOTP: string, expiresAt: Date): boolean => {
  // Check if OTP is expired
  if (new Date() > expiresAt) {
    return false;
  }

  // Check if OTP matches
  return inputOTP === storedOTP;
};

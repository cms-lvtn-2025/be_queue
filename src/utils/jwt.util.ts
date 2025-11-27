import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-change-this';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '12h';

export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  type: 'temp' | 'access';
}

/**
 * Generate temporary token (used after email/password login, before 2FA)
 */
export const generateTempToken = (userId: string, email: string, role: string): string => {
  const payload: JWTPayload = {
    userId,
    email,
    role,
    type: 'temp',
  };

  // Temp token expires in 15 minutes
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '15m' });
};

/**
 * Generate access token (used after 2FA verification)
 * Valid for 12 hours
 */
export const generateAccessToken = (userId: string, email: string, role: string): string => {
  const payload: JWTPayload = {
    userId,
    email,
    role,
    type: 'access',
  };

  return jwt.sign(payload, JWT_SECRET, { expiresIn: '12h' });
};

/**
 * Verify and decode JWT token
 */
export const verifyToken = (token: string): JWTPayload => {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
};

/**
 * Get token expiration date
 */
export const getTokenExpiration = (token: string): Date | null => {
  try {
    const decoded = jwt.decode(token) as any;
    if (decoded && decoded.exp) {
      return new Date(decoded.exp * 1000);
    }
    return null;
  } catch (error) {
    return null;
  }
};

/**
 * Check if token is expired
 */
export const isTokenExpired = (token: string): boolean => {
  const expiration = getTokenExpiration(token);
  if (!expiration) return true;
  return expiration < new Date();
};

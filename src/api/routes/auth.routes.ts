import { Router } from 'express';
import {
  login,
  setup2FA,
  verify2FA,
  requestOTPEmail,
  verifyOTPEmail,
  getMe,
  logout,
  register,
} from '../controllers/auth.controller';
import {
  authenticateToken,
  authenticateTempToken,
  requireAdmin,
  rateLimitLogin,
  rateLimitOTP,
} from '../../middleware/auth.middleware';

const router = Router();

/**
 * Public routes
 */

// Login with email & password (returns temp token)
router.post('/login', rateLimitLogin, login);

/**
 * Temp token required routes (after login, before 2FA)
 */

// Setup Google Authenticator 2FA
router.post('/setup-2fa', authenticateTempToken, setup2FA);

// Verify 2FA code (returns access token)
router.post('/verify-2fa', authenticateTempToken, verify2FA);

// Request OTP via email
router.post('/request-otp-email', authenticateTempToken, rateLimitOTP, requestOTPEmail);

// Verify email OTP (returns access token)
router.post('/verify-otp-email', authenticateTempToken, verifyOTPEmail);

/**
 * Access token required routes (after 2FA verification)
 */

// Get current user info
router.get('/me', authenticateToken, getMe);

// Logout
router.post('/logout', authenticateToken, logout);

// Register new user (admin only)
router.post('/register', authenticateToken, requireAdmin, register);

export default router;

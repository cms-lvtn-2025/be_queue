import { Request, Response } from 'express';
import { UserModel } from '../../database/models';
import { hashPassword, comparePassword, validatePassword } from '../../utils/password.util';
import {
  generateTempToken,
  generateAccessToken,
  getTokenExpiration,
} from '../../utils/jwt.util';
import {
  generate2FASecret,
  generateQRCode,
  verify2FAToken,
  generateEmailOTP,
  verifyEmailOTP,
} from '../../utils/otp.util';
import { emailService } from '../../services/email.service';

/**
 * Login with email and password
 * Returns temporary token for 2FA verification
 */
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      res.status(400).json({
        success: false,
        message: 'Email and password are required',
      });
      return;
    }

    // Find user
    const user = await UserModel.findOne({ email: email.toLowerCase() });
    if (!user) {
      res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
      return;
    }

    // Check if user is enabled
    if (!user.enabled) {
      res.status(401).json({
        success: false,
        message: 'Account is disabled. Please contact administrator.',
      });
      return;
    }

    // Compare password
    const isPasswordValid = await comparePassword(password, user.passwordHash);
    if (!isPasswordValid) {
      res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
      return;
    }

    // Generate temporary token (15 minutes)
    const tempToken = generateTempToken(String(user._id), user.email, user.role);

    res.status(200).json({
      success: true,
      message: 'Login successful. Please verify with 2FA or request OTP.',
      data: {
        tempToken,
        userId: user._id,
        email: user.email,
        twoFactorEnabled: user.twoFactorEnabled,
        requiresVerification: true,
      },
    });
  } catch (error) {
    console.error('[AuthController] Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during login',
    });
  }
};

/**
 * Setup Google Authenticator 2FA
 * Requires temporary token
 */
export const setup2FA = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
      return;
    }

    // Find user
    const user = await UserModel.findById(req.user.userId);
    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found',
      });
      return;
    }

    // Generate 2FA secret
    const { secret, otpauth_url } = generate2FASecret(user.email);

    // Generate QR code
    const qrCodeUrl = await generateQRCode(otpauth_url);

    // Save secret to user (but don't enable 2FA yet)
    user.twoFactorSecret = secret;
    await user.save();

    res.status(200).json({
      success: true,
      message: '2FA setup initiated. Scan QR code with Google Authenticator app.',
      data: {
        secret,
        qrCodeUrl,
        manualEntryKey: secret,
      },
    });
  } catch (error) {
    console.error('[AuthController] Setup 2FA error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during 2FA setup',
    });
  }
};

/**
 * Verify 2FA token and get access token
 * Requires temporary token
 */
export const verify2FA = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.body;

    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
      return;
    }

    if (!token) {
      res.status(400).json({
        success: false,
        message: '2FA token is required',
      });
      return;
    }

    // Find user
    const user = await UserModel.findById(req.user.userId);
    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found',
      });
      return;
    }

    // Check if user has 2FA secret
    if (!user.twoFactorSecret) {
      res.status(400).json({
        success: false,
        message: '2FA is not set up. Please set up 2FA first.',
      });
      return;
    }

    // Verify 2FA token
    const isValid = verify2FAToken(token, user.twoFactorSecret);
    if (!isValid) {
      res.status(401).json({
        success: false,
        message: 'Invalid 2FA token',
      });
      return;
    }

    // Enable 2FA if this is first time verification
    if (!user.twoFactorEnabled) {
      user.twoFactorEnabled = true;
    }

    // Generate access token (12 hours)
    const accessToken = generateAccessToken(String(user._id), user.email, user.role);
    const expiresAt = getTokenExpiration(accessToken);

    // Update user last login and token expiration
    user.lastLogin = new Date();
    user.currentTokenExpires = expiresAt || undefined;
    await user.save();

    // Set cookie for Bull Board authentication
    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 12 * 60 * 60 * 1000, // 12 hours
    });

    res.status(200).json({
      success: true,
      message: '2FA verified successfully',
      data: {
        accessToken,
        expiresIn: '12h',
        expiresAt,
        user: {
          id: user._id,
          email: user.email,
          role: user.role,
        },
      },
    });
  } catch (error) {
    console.error('[AuthController] Verify 2FA error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during 2FA verification',
    });
  }
};

/**
 * Request OTP via email
 * Requires temporary token
 */
export const requestOTPEmail = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
      return;
    }

    // Find user
    const user = await UserModel.findById(req.user.userId);
    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found',
      });
      return;
    }

    // Generate OTP
    const otp = generateEmailOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Save OTP to user
    user.emailOtp = otp;
    user.emailOtpExpires = expiresAt;
    await user.save();

    // Send OTP email
    try {
      await emailService.sendOTPEmail(user.email, otp);
    } catch (emailError) {
      console.error('[AuthController] Failed to send OTP email:', emailError);
      res.status(500).json({
        success: false,
        message: 'Failed to send OTP email. Please try again.',
      });
      return;
    }

    // Mask email for response
    const maskedEmail = user.email.replace(/(.{4})(.*)(@.*)/, '$1***$3');

    res.status(200).json({
      success: true,
      message: 'OTP sent to your email',
      data: {
        email: maskedEmail,
        expiresIn: '10 minutes',
      },
    });
  } catch (error) {
    console.error('[AuthController] Request OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during OTP request',
    });
  }
};

/**
 * Verify email OTP and get access token
 * Requires temporary token
 */
export const verifyOTPEmail = async (req: Request, res: Response): Promise<void> => {
  try {
    const { otp } = req.body;

    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
      return;
    }

    if (!otp) {
      res.status(400).json({
        success: false,
        message: 'OTP is required',
      });
      return;
    }

    // Find user
    const user = await UserModel.findById(req.user.userId);
    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found',
      });
      return;
    }

    // Check if OTP exists
    if (!user.emailOtp || !user.emailOtpExpires) {
      res.status(400).json({
        success: false,
        message: 'No OTP found. Please request OTP first.',
      });
      return;
    }

    // Verify OTP
    const isValid = verifyEmailOTP(otp, user.emailOtp, user.emailOtpExpires);
    if (!isValid) {
      res.status(401).json({
        success: false,
        message: 'Invalid or expired OTP',
      });
      return;
    }

    // Clear OTP
    user.emailOtp = undefined;
    user.emailOtpExpires = undefined;

    // Generate access token (12 hours)
    const accessToken = generateAccessToken(String(user._id), user.email, user.role);
    const expiresAt = getTokenExpiration(accessToken);

    // Update user last login and token expiration
    user.lastLogin = new Date();
    user.currentTokenExpires = expiresAt || undefined;
    await user.save();

    // Set cookie for Bull Board authentication
    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 12 * 60 * 60 * 1000, // 12 hours
    });

    res.status(200).json({
      success: true,
      message: 'OTP verified successfully',
      data: {
        accessToken,
        expiresIn: '12h',
        expiresAt,
        user: {
          id: user._id,
          email: user.email,
          role: user.role,
        },
      },
    });
  } catch (error) {
    console.error('[AuthController] Verify OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during OTP verification',
    });
  }
};

/**
 * Get current user info
 * Requires access token
 */
export const getMe = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
      return;
    }

    // Find user
    const user = await UserModel.findById(req.user.userId).select('-passwordHash -twoFactorSecret -emailOtp');
    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found',
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        id: user._id,
        email: user.email,
        role: user.role,
        twoFactorEnabled: user.twoFactorEnabled,
        lastLogin: user.lastLogin,
        tokenExpiresAt: user.currentTokenExpires,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error('[AuthController] Get me error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

/**
 * Logout
 * Invalidate current token (client-side should remove token)
 */
export const logout = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
      return;
    }

    // Update user to clear token expiration
    await UserModel.findByIdAndUpdate(req.user.userId, {
      currentTokenExpires: null,
    });

    res.status(200).json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    console.error('[AuthController] Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during logout',
    });
  }
};

/**
 * Register new user (admin only)
 */
export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, role } = req.body;

    // Validation
    if (!email || !password) {
      res.status(400).json({
        success: false,
        message: 'Email and password are required',
      });
      return;
    }

    // Validate password
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      res.status(400).json({
        success: false,
        message: passwordValidation.message,
      });
      return;
    }

    // Check if user already exists
    const existingUser = await UserModel.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      res.status(400).json({
        success: false,
        message: 'User with this email already exists',
      });
      return;
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user
    const user = await UserModel.create({
      email: email.toLowerCase(),
      passwordHash,
      role: role || 'user',
      enabled: true,
      twoFactorEnabled: false,
    });

    // Send welcome email (optional, don't block on failure)
    emailService.sendWelcomeEmail(user.email).catch((err) => {
      console.error('[AuthController] Failed to send welcome email:', err);
    });

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: {
        id: user._id,
        email: user.email,
        role: user.role,
        twoFactorEnabled: user.twoFactorEnabled,
      },
    });
  } catch (error) {
    console.error('[AuthController] Register error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during registration',
    });
  }
};

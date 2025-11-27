import { Request, Response, NextFunction } from 'express';
import { verifyToken, JWTPayload } from '../utils/jwt.util';
import { UserModel } from '../database/models';

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        email: string;
        role: string;
      };
    }
  }
}

/**
 * Middleware to verify JWT access token
 */
export const authenticateToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;

    if (!token) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized. No token provided.',
      });
      return;
    }

    // Verify token
    let payload: JWTPayload;
    try {
      payload = verifyToken(token);
    } catch (error) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized. Invalid or expired token.',
      });
      return;
    }

    // Check if it's an access token (not temp token)
    if (payload.type !== 'access') {
      res.status(401).json({
        success: false,
        message: 'Unauthorized. Please complete 2FA verification first.',
      });
      return;
    }

    // Check if user still exists and is enabled
    const user = await UserModel.findById(payload.userId);
    if (!user || !user.enabled) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized. User not found or disabled.',
      });
      return;
    }

    // Attach user to request
    req.user = {
      userId: payload.userId,
      email: payload.email,
      role: payload.role,
    };

    next();
  } catch (error) {
    console.error('[AuthMiddleware] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during authentication',
    });
  }
};

/**
 * Middleware to verify temporary token (used for 2FA flow)
 */
export const authenticateTempToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;

    if (!token) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized. No token provided.',
      });
      return;
    }

    // Verify token
    let payload: JWTPayload;
    try {
      payload = verifyToken(token);
    } catch (error) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized. Invalid or expired token.',
      });
      return;
    }

    // Check if it's a temp token
    if (payload.type !== 'temp') {
      res.status(400).json({
        success: false,
        message: 'Invalid token type. Expected temporary token.',
      });
      return;
    }

    // Check if user still exists
    const user = await UserModel.findById(payload.userId);
    if (!user || !user.enabled) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized. User not found or disabled.',
      });
      return;
    }

    // Attach user to request
    req.user = {
      userId: payload.userId,
      email: payload.email,
      role: payload.role,
    };

    next();
  } catch (error) {
    console.error('[AuthMiddleware] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during authentication',
    });
  }
};

/**
 * Middleware to check if user has admin role
 */
export const requireAdmin = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      message: 'Unauthorized. Authentication required.',
    });
    return;
  }

  if (req.user.role !== 'admin') {
    res.status(403).json({
      success: false,
      message: 'Forbidden. Admin access required.',
    });
    return;
  }

  next();
};

/**
 * Rate limiting map for login attempts
 */
const loginAttempts = new Map<string, { count: number; resetAt: Date }>();

/**
 * Simple rate limiter for login endpoint
 * 5 attempts per 15 minutes per IP
 */
export const rateLimitLogin = (req: Request, res: Response, next: NextFunction): void => {
  const ip = req.ip || 'unknown';
  const now = new Date();
  const key = `login:${ip}`;

  const attempt = loginAttempts.get(key);

  if (attempt) {
    if (now > attempt.resetAt) {
      // Reset expired attempt
      loginAttempts.set(key, { count: 1, resetAt: new Date(now.getTime() + 15 * 60 * 1000) });
      next();
    } else if (attempt.count >= 5) {
      // Too many attempts
      res.status(429).json({
        success: false,
        message: 'Too many login attempts. Please try again later.',
      });
    } else {
      // Increment attempt
      attempt.count++;
      next();
    }
  } else {
    // First attempt
    loginAttempts.set(key, { count: 1, resetAt: new Date(now.getTime() + 15 * 60 * 1000) });
    next();
  }
};

/**
 * Rate limiter for OTP requests
 * 3 requests per 15 minutes per user
 */
const otpAttempts = new Map<string, { count: number; resetAt: Date }>();

export const rateLimitOTP = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      message: 'Unauthorized',
    });
    return;
  }

  const now = new Date();
  const key = `otp:${req.user.userId}`;

  const attempt = otpAttempts.get(key);

  if (attempt) {
    if (now > attempt.resetAt) {
      // Reset expired attempt
      otpAttempts.set(key, { count: 1, resetAt: new Date(now.getTime() + 15 * 60 * 1000) });
      next();
    } else if (attempt.count >= 3) {
      // Too many attempts
      res.status(429).json({
        success: false,
        message: 'Too many OTP requests. Please try again later.',
      });
    } else {
      // Increment attempt
      attempt.count++;
      next();
    }
  } else {
    // First attempt
    otpAttempts.set(key, { count: 1, resetAt: new Date(now.getTime() + 15 * 60 * 1000) });
    next();
  }
};

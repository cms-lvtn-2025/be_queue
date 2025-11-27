import { Request, Response, NextFunction } from 'express';
import { verifyToken, JWTPayload } from '../utils/jwt.util';
import { UserModel } from '../database/models';

/**
 * Middleware for BullMQ Board - checks JWT from cookie or Authorization header
 * This allows iframe to work by using cookies
 */
export const authenticateBullMQ = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    let token: string | null = null;

    // Try to get token from Authorization header first
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }

    // If no header token, try to get from cookie
    if (!token && req.cookies && req.cookies.accessToken) {
      token = req.cookies.accessToken;
    }

    // If still no token, try to get from query parameter (for iframe support)
    if (!token && req.query && req.query.token) {
      token = req.query.token as string;
    }

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

    // Check if it's an access token
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
    console.error('[BullMQAuthMiddleware] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during authentication',
    });
  }
};

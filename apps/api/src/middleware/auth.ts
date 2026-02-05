import type { Request, Response, NextFunction } from 'express';
import { prisma, UserRole } from '@repo/database';
import { AppError } from './error-handler.js';

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        name: string;
        role: UserRole;
      };
    }
  }
}

/**
 * Authentication middleware
 * Expects Authorization header: Bearer <token>
 * For now, we'll use a simple user ID as token (replace with JWT in production)
 */
export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError(401, 'Authentication required', 'UNAUTHORIZED');
    }

    const token = authHeader.substring(7); // Remove 'Bearer '

    // In production, verify JWT token here
    // For now, treat token as user ID for simplicity
    const user = await prisma.user.findUnique({
      where: { id: token },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      },
    });

    if (!user) {
      throw new AppError(401, 'Invalid authentication token', 'INVALID_TOKEN');
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Optional authentication - doesn't fail if no token provided
 */
export async function optionalAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);

      const user = await prisma.user.findUnique({
        where: { id: token },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
        },
      });

      if (user) {
        req.user = user;
      }
    }

    next();
  } catch (error) {
    // Don't fail, just continue without user
    next();
  }
}

/**
 * Role-based authorization middleware
 * Must be used after authenticate middleware
 */
export function authorize(...allowedRoles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new AppError(401, 'Authentication required', 'UNAUTHORIZED'));
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      next(
        new AppError(
          403,
          'You do not have permission to perform this action',
          'FORBIDDEN'
        )
      );
      return;
    }

    next();
  };
}

/**
 * Require ADMIN role
 */
export const requireAdmin = authorize(UserRole.ADMIN);

/**
 * Require ADMIN or MANAGER role
 */
export const requireAdminOrManager = authorize(UserRole.ADMIN, UserRole.MANAGER);

import jwt from 'jsonwebtoken';
import type { Socket } from 'socket.io';
import type { ExtendedError } from 'socket.io/dist/namespace';
import type { SocketData } from '../modules/bookings/booking.types.js';

// ============================================================================
// JWT CONFIGURATION
// ============================================================================

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

export interface JWTPayload {
  userId: string;
  email: string;
  role: 'ADMIN' | 'MANAGER' | 'USER';
  iat?: number;
  exp?: number;
}

// ============================================================================
// SOCKET AUTHENTICATION MIDDLEWARE
// ============================================================================

/**
 * Authenticate socket connections using JWT
 * Token can be passed in:
 * 1. auth.token in socket handshake
 * 2. Authorization header (Bearer token)
 * 3. Query parameter ?token=xxx
 */
export function socketAuthMiddleware(
  socket: Socket<any, any, any, SocketData>,
  next: (err?: ExtendedError) => void
): void {
  try {
    // Extract token from various sources
    const token = extractToken(socket);

    if (!token) {
      return next(createAuthError('Authentication required'));
    }

    // Verify JWT
    const payload = verifyToken(token);

    // Attach user data to socket
    socket.data.userId = payload.userId;
    socket.data.email = payload.email;
    socket.data.role = payload.role;
    socket.data.joinedSessions = new Set();

    console.log(`[Socket Auth] User ${payload.email} authenticated (${payload.role})`);
    next();
  } catch (error) {
    console.error('[Socket Auth] Authentication failed:', error);

    if (error instanceof jwt.TokenExpiredError) {
      return next(createAuthError('Token expired'));
    }

    if (error instanceof jwt.JsonWebTokenError) {
      return next(createAuthError('Invalid token'));
    }

    return next(createAuthError('Authentication failed'));
  }
}

/**
 * Extract token from socket handshake
 */
function extractToken(socket: Socket): string | null {
  // 1. From auth object (recommended)
  if (socket.handshake.auth?.token) {
    return socket.handshake.auth.token;
  }

  // 2. From Authorization header
  const authHeader = socket.handshake.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  // 3. From query parameter (least secure, use for testing)
  if (socket.handshake.query?.token) {
    return socket.handshake.query.token as string;
  }

  return null;
}

/**
 * Verify and decode JWT token
 */
function verifyToken(token: string): JWTPayload {
  const payload = jwt.verify(token, JWT_SECRET) as JWTPayload;

  if (!payload.userId || !payload.email || !payload.role) {
    throw new Error('Invalid token payload');
  }

  return payload;
}

/**
 * Create an authentication error
 */
function createAuthError(message: string): ExtendedError {
  const error = new Error(message) as ExtendedError;
  error.data = { code: 'UNAUTHORIZED', message };
  return error;
}

// ============================================================================
// TOKEN GENERATION (for testing/development)
// ============================================================================

/**
 * Generate a JWT token (for testing purposes)
 */
export function generateToken(
  userId: string,
  email: string,
  role: 'ADMIN' | 'MANAGER' | 'USER' = 'USER',
  expiresIn: string = '24h'
): string {
  return jwt.sign(
    { userId, email, role },
    JWT_SECRET,
    { expiresIn }
  );
}

/**
 * Decode token without verification (for debugging)
 */
export function decodeToken(token: string): JWTPayload | null {
  try {
    return jwt.decode(token) as JWTPayload;
  } catch {
    return null;
  }
}

// ============================================================================
// ROLE-BASED AUTHORIZATION MIDDLEWARE
// ============================================================================

/**
 * Create middleware that requires specific roles
 */
export function requireRole(...allowedRoles: Array<'ADMIN' | 'MANAGER' | 'USER'>) {
  return (
    socket: Socket<any, any, any, SocketData>,
    next: (err?: ExtendedError) => void
  ): void => {
    if (!socket.data.role) {
      return next(createAuthError('Not authenticated'));
    }

    if (!allowedRoles.includes(socket.data.role)) {
      const error = new Error('Insufficient permissions') as ExtendedError;
      error.data = { code: 'FORBIDDEN', message: 'Insufficient permissions' };
      return next(error);
    }

    next();
  };
}

// ============================================================================
// GUEST USER SUPPORT (for anonymous browsing)
// ============================================================================

/**
 * Alternative middleware that allows guest users
 * Guest users get a temporary ID but limited capabilities
 */
export function socketAuthWithGuestMiddleware(
  socket: Socket<any, any, any, SocketData>,
  next: (err?: ExtendedError) => void
): void {
  try {
    const token = extractToken(socket);

    if (token) {
      // Authenticated user
      const payload = verifyToken(token);
      socket.data.userId = payload.userId;
      socket.data.email = payload.email;
      socket.data.role = payload.role;
    } else {
      // Guest user
      socket.data.userId = `guest_${socket.id}`;
      socket.data.email = '';
      socket.data.role = 'USER';
    }

    socket.data.joinedSessions = new Set();
    next();
  } catch (error) {
    // If token is invalid, treat as guest
    socket.data.userId = `guest_${socket.id}`;
    socket.data.email = '';
    socket.data.role = 'USER';
    socket.data.joinedSessions = new Set();
    next();
  }
}

import { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
} from '../modules/bookings/booking.types.js';
import { socketAuthMiddleware, socketAuthWithGuestMiddleware } from './socket.auth.js';
import { setupBookingSocketHandlers, createBroadcastHelpers } from '../modules/bookings/booking.socket-handler.js';

// ============================================================================
// SOCKET.IO SERVER CONFIGURATION
// ============================================================================

export interface SocketServerOptions {
  /** HTTP server instance */
  httpServer: HttpServer;
  /** CORS origin (defaults to all) */
  corsOrigin?: string | string[];
  /** Whether to allow guest users */
  allowGuests?: boolean;
  /** Ping timeout in ms */
  pingTimeout?: number;
  /** Ping interval in ms */
  pingInterval?: number;
}

// ============================================================================
// SOCKET SERVER SETUP
// ============================================================================

export function createSocketServer(options: SocketServerOptions) {
  const {
    httpServer,
    corsOrigin = '*',
    allowGuests = false,
    pingTimeout = 20000,
    pingInterval = 25000,
  } = options;

  // Create Socket.io server with typed events
  const io = new Server<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >(httpServer, {
    cors: {
      origin: corsOrigin,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout,
    pingInterval,
    // Connection state recovery
    connectionStateRecovery: {
      maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes
      skipMiddlewares: false,
    },
    // Transports
    transports: ['websocket', 'polling'],
  });

  // ===========================================================================
  // MIDDLEWARE SETUP
  // ===========================================================================

  // Global authentication middleware for /bookings namespace
  const bookingsNamespace = io.of('/bookings');
  
  if (allowGuests) {
    bookingsNamespace.use(socketAuthWithGuestMiddleware);
  } else {
    bookingsNamespace.use(socketAuthMiddleware);
  }

  // ===========================================================================
  // HANDLER SETUP
  // ===========================================================================

  // Setup booking handlers
  setupBookingSocketHandlers(io);

  // ===========================================================================
  // CONNECTION MONITORING
  // ===========================================================================

  // Track total connections
  let connectionCount = 0;

  io.on('connection', (socket) => {
    connectionCount++;
    console.log(`[Socket] New connection: ${socket.id} (total: ${connectionCount})`);

    socket.on('disconnect', () => {
      connectionCount--;
      console.log(`[Socket] Disconnected: ${socket.id} (total: ${connectionCount})`);
    });
  });

  // ===========================================================================
  // UTILITIES
  // ===========================================================================

  const broadcastHelpers = createBroadcastHelpers(io);

  return {
    io,
    broadcastHelpers,
    getConnectionCount: () => connectionCount,
    
    /**
     * Graceful shutdown
     */
    async close(): Promise<void> {
      return new Promise((resolve) => {
        io.close(() => {
          console.log('[Socket] Server closed');
          resolve();
        });
      });
    },
  };
}

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type { BookingServer, BookingSocket } from '../modules/bookings/booking.socket-handler.js';

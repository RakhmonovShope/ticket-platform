import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { venueRoutes } from './modules/venues/venue.routes.js';
import { sessionRoutes } from './modules/sessions/session.routes.js';
import { paymentRoutes } from './modules/payments/payment.routes.js';
import { errorHandler } from './middleware/error-handler.js';
import { createSocketServer } from './socket/socket.server.js';
import { redis } from './services/redis.service.js';
import { startExpirationJob, stopExpirationJob } from './jobs/expiration.job.js';

// ============================================================================
// EXPRESS APP SETUP
// ============================================================================

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 3001;
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

// Middleware
app.use(helmet());
app.use(cors({ origin: CORS_ORIGIN, credentials: true }));
app.use(morgan('dev'));
app.use(express.json());

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/venues', venueRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/payments', paymentRoutes);

// Error handling
app.use(errorHandler);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// ============================================================================
// SOCKET.IO SERVER SETUP
// ============================================================================

const socketServer = createSocketServer({
  httpServer,
  corsOrigin: CORS_ORIGIN,
  allowGuests: process.env.ALLOW_GUESTS === 'true',
});

// Make socket.io available to controllers
app.set('io', socketServer.io);

// ============================================================================
// START SERVER
// ============================================================================

async function startServer(): Promise<void> {
  try {
    // Connect to Redis
    console.log('Connecting to Redis...');
    await redis.connect();
    console.log('✅ Redis connected');

    // Start expiration job
    const expirationJob = startExpirationJob(socketServer);
    console.log('✅ Expiration job started');

    // Start HTTP server
    httpServer.listen(PORT, () => {
      console.log(`🚀 API server running on http://localhost:${PORT}`);
      console.log(`🔌 WebSocket server running on ws://localhost:${PORT}/bookings`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// ============================================================================
// GRACEFUL SHUTDOWN
// ============================================================================

async function shutdown(): Promise<void> {
  console.log('\nShutting down...');

  // Stop expiration job
  stopExpirationJob();

  // Close socket server
  await socketServer.close();

  // Disconnect Redis
  await redis.disconnect();

  // Close HTTP server
  httpServer.close(() => {
    console.log('Server closed');
    process.exit(0);
  });

  // Force exit after 10 seconds
  setTimeout(() => {
    console.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Start the server
startServer();

export { app, httpServer, socketServer };

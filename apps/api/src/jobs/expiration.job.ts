import { bookingService } from '../modules/bookings/booking.service.js';
import { BOOKING_CONFIG, SOCKET_EVENTS } from '../modules/bookings/booking.types.js';
import type { createSocketServer } from '../socket/socket.server.js';

// ============================================================================
// EXPIRATION JOB
// ============================================================================

type SocketServer = ReturnType<typeof createSocketServer>;

/**
 * Job that periodically checks for and processes expired reservations
 */
export class ExpirationJob {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private socketServer: SocketServer | null = null;

  constructor(socketServer?: SocketServer) {
    this.socketServer = socketServer ?? null;
  }

  /**
   * Start the expiration check job
   */
  start(intervalMs: number = BOOKING_CONFIG.EXPIRATION_CHECK_INTERVAL_MS): void {
    if (this.intervalId) {
      console.log('[Expiration Job] Already running');
      return;
    }

    console.log(`[Expiration Job] Starting (interval: ${intervalMs}ms)`);

    // Run immediately on start
    this.runCheck();

    // Then run on interval
    this.intervalId = setInterval(() => {
      this.runCheck();
    }, intervalMs);
  }

  /**
   * Stop the expiration check job
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('[Expiration Job] Stopped');
    }
  }

  /**
   * Set socket server reference (for broadcasting)
   */
  setSocketServer(socketServer: SocketServer): void {
    this.socketServer = socketServer;
  }

  /**
   * Run a single expiration check
   */
  private async runCheck(): Promise<void> {
    if (this.isRunning) {
      console.log('[Expiration Job] Previous check still running, skipping');
      return;
    }

    this.isRunning = true;

    try {
      const startTime = Date.now();
      const expiredBookings = await bookingService.processExpiredReservations();

      if (expiredBookings.length > 0) {
        console.log(`[Expiration Job] Processed ${expiredBookings.length} expired bookings`);

        // Broadcast seat releases via WebSocket
        if (this.socketServer) {
          for (const { seatId, sessionId } of expiredBookings) {
            this.socketServer.broadcastHelpers.broadcastSeatReleased(sessionId, seatId, 'timeout');
          }
        }
      }

      const duration = Date.now() - startTime;
      if (duration > 1000) {
        console.log(`[Expiration Job] Check took ${duration}ms`);
      }
    } catch (error) {
      console.error('[Expiration Job] Error during check:', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Force run check (for testing)
   */
  async forceRun(): Promise<void> {
    await this.runCheck();
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let expirationJob: ExpirationJob | null = null;

export function getExpirationJob(): ExpirationJob {
  if (!expirationJob) {
    expirationJob = new ExpirationJob();
  }
  return expirationJob;
}

export function startExpirationJob(socketServer?: SocketServer): ExpirationJob {
  const job = getExpirationJob();
  if (socketServer) {
    job.setSocketServer(socketServer);
  }
  job.start();
  return job;
}

export function stopExpirationJob(): void {
  if (expirationJob) {
    expirationJob.stop();
  }
}

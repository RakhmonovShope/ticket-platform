import { Server, Socket } from 'socket.io';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
  JoinSessionPayload,
  LeaveSessionPayload,
  SelectSeatPayload,
  ReserveSeatsPayload,
  ReleaseSeatsPayload,
} from './booking.types.js';
import {
  JoinSessionSchema,
  LeaveSessionSchema,
  SelectSeatSchema,
  ReserveSeatsSchema,
  ReleaseSeatsSchema,
  SOCKET_EVENTS,
  BOOKING_CONFIG,
} from './booking.types.js';
import { bookingService } from './booking.service.js';
import { toErrorEvent, RateLimitExceededError } from './booking.errors.js';
import { ZodError } from 'zod';

// ============================================================================
// TYPE ALIASES
// ============================================================================

export type BookingSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

export type BookingServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

// ============================================================================
// SOCKET HANDLER
// ============================================================================

export function setupBookingSocketHandlers(io: BookingServer): void {
  const bookingsNamespace = io.of('/bookings');

  bookingsNamespace.on('connection', (socket: BookingSocket) => {
    const userId = socket.data.userId;
    const socketId = socket.id;

    console.log(`[Booking] User ${userId} connected (socket: ${socketId})`);

    // Initialize joined sessions tracking
    socket.data.joinedSessions = new Set();

    // =========================================================================
    // JOIN SESSION
    // =========================================================================

    socket.on(SOCKET_EVENTS.JOIN_SESSION, async (payload, callback) => {
      try {
        // Validate payload
        const { sessionId } = JoinSessionSchema.parse(payload);

        // Validate session exists and is active
        await bookingService.validateSession(sessionId);

        // Join Socket.io room
        await socket.join(`session:${sessionId}`);
        socket.data.joinedSessions.add(sessionId);

        // Track user in Redis
        const usersOnline = await bookingService.joinSession(sessionId, socketId);

        // Get current session state
        const sessionState = await bookingService.getSessionState(sessionId);

        // Send session state to the joining user
        socket.emit(SOCKET_EVENTS.SESSION_STATE, {
          sessionId: sessionState.sessionId,
          seats: sessionState.seats.map((seat) => ({
            seatId: seat.id,
            status: seat.status,
            reservedBy: seat.reservedBy === userId ? 'you' : seat.reservedBy ? 'another_user' : undefined,
            expiresAt: seat.expiresAt,
          })),
          usersOnline,
        });

        // Notify others in session about new user
        socket.to(`session:${sessionId}`).emit(SOCKET_EVENTS.SESSION_UPDATED, {
          sessionId,
          status: sessionState.status,
          availableSeats: sessionState.seats.filter((s) => s.status === 'AVAILABLE').length,
        });

        callback({ success: true });
        console.log(`[Booking] User ${userId} joined session ${sessionId} (${usersOnline} online)`);
      } catch (error) {
        console.error('[Booking] Join session error:', error);
        callback({ success: false, error: toErrorEvent(error).message });
      }
    });

    // =========================================================================
    // LEAVE SESSION
    // =========================================================================

    socket.on(SOCKET_EVENTS.LEAVE_SESSION, async (payload) => {
      try {
        const { sessionId } = LeaveSessionSchema.parse(payload);
        await handleLeaveSession(socket, sessionId);
      } catch (error) {
        console.error('[Booking] Leave session error:', error);
      }
    });

    // =========================================================================
    // SELECT SEAT
    // =========================================================================

    socket.on(SOCKET_EVENTS.SELECT_SEAT, async (payload, callback) => {
      try {
        // Validate payload
        const { sessionId, seatId } = SelectSeatSchema.parse(payload);

        // Check rate limit
        const rateLimit = await bookingService.checkRateLimit(userId, 'select');
        if (!rateLimit.allowed) {
          socket.emit(SOCKET_EVENTS.RATE_LIMITED, { retryAfter: rateLimit.retryAfter! });
          throw new RateLimitExceededError(rateLimit.retryAfter!);
        }

        // Select seat
        const result = await bookingService.selectSeat(sessionId, seatId, userId, socketId);

        // Notify all users in session
        socket.to(`session:${sessionId}`).emit(SOCKET_EVENTS.SEAT_SELECTED, {
          seatId,
          selectedBy: 'another_user',
        });

        // Also emit to self with 'you' identifier
        socket.emit(SOCKET_EVENTS.SEAT_SELECTED, {
          seatId,
          selectedBy: 'you',
        });

        callback({ success: true });
        console.log(`[Booking] User ${userId} selected seat ${seatId} in session ${sessionId}`);
      } catch (error) {
        console.error('[Booking] Select seat error:', error);
        const errorEvent = toErrorEvent(error);
        socket.emit(SOCKET_EVENTS.ERROR, errorEvent);
        callback({ success: false, error: errorEvent.message });
      }
    });

    // =========================================================================
    // RESERVE SEATS (CREATE BOOKING)
    // =========================================================================

    socket.on(SOCKET_EVENTS.RESERVE_SEATS, async (payload, callback) => {
      try {
        // Validate payload
        const { sessionId, seatIds } = ReserveSeatsSchema.parse(payload);

        // Reserve seats and create booking
        const result = await bookingService.reserveSeats(sessionId, seatIds, userId, socketId);

        // Notify all users in session about each reserved seat
        for (const seat of result.seats) {
          // Notify others
          socket.to(`session:${sessionId}`).emit(SOCKET_EVENTS.SEAT_RESERVED, {
            seatId: seat.seatId,
            reservedBy: 'another_user',
            expiresAt: result.expiresAt.getTime(),
            bookingId: result.bookingId,
          });

          // Notify self
          socket.emit(SOCKET_EVENTS.SEAT_RESERVED, {
            seatId: seat.seatId,
            reservedBy: 'you',
            expiresAt: result.expiresAt.getTime(),
            bookingId: result.bookingId,
          });
        }

        callback({ success: true, bookingId: result.bookingId });
        console.log(
          `[Booking] User ${userId} reserved ${seatIds.length} seats in session ${sessionId} (booking: ${result.bookingId})`
        );
      } catch (error) {
        console.error('[Booking] Reserve seats error:', error);
        const errorEvent = toErrorEvent(error);
        socket.emit(SOCKET_EVENTS.ERROR, errorEvent);
        callback({ success: false, error: errorEvent.message });
      }
    });

    // =========================================================================
    // RELEASE SEATS
    // =========================================================================

    socket.on(SOCKET_EVENTS.RELEASE_SEATS, async (payload, callback) => {
      try {
        // Validate payload
        const { sessionId, seatIds } = ReleaseSeatsSchema.parse(payload);

        // Release seats
        const releasedSeats = await bookingService.releaseSeats(sessionId, seatIds, userId);

        // Notify all users in session about each released seat
        for (const seatId of releasedSeats) {
          bookingsNamespace.to(`session:${sessionId}`).emit(SOCKET_EVENTS.SEAT_RELEASED, {
            seatId,
            reason: 'cancelled',
          });
        }

        callback({ success: true });
        console.log(
          `[Booking] User ${userId} released ${releasedSeats.length} seats in session ${sessionId}`
        );
      } catch (error) {
        console.error('[Booking] Release seats error:', error);
        const errorEvent = toErrorEvent(error);
        socket.emit(SOCKET_EVENTS.ERROR, errorEvent);
        callback({ success: false, error: errorEvent.message });
      }
    });

    // =========================================================================
    // DISCONNECT
    // =========================================================================

    socket.on('disconnect', async (reason) => {
      console.log(`[Booking] User ${userId} disconnected (reason: ${reason})`);

      // Leave all sessions and release selections
      for (const sessionId of socket.data.joinedSessions) {
        await handleLeaveSession(socket, sessionId, true);
      }
    });
  });

  // ===========================================================================
  // HELPER FUNCTIONS
  // ===========================================================================

  async function handleLeaveSession(
    socket: BookingSocket,
    sessionId: string,
    isDisconnect: boolean = false
  ): Promise<void> {
    const userId = socket.data.userId;
    const socketId = socket.id;

    try {
      // Release any selected seats (not booked)
      const releasedSeats = await bookingService.releaseSocketSelections(sessionId, socketId);

      // Notify others about released seats
      for (const seatId of releasedSeats) {
        socket.to(`session:${sessionId}`).emit(SOCKET_EVENTS.SEAT_RELEASED, {
          seatId,
          reason: isDisconnect ? 'timeout' : 'cancelled',
        });
      }

      // Leave Redis tracking
      const usersOnline = await bookingService.leaveSession(sessionId, socketId);

      // Leave Socket.io room
      await socket.leave(`session:${sessionId}`);
      socket.data.joinedSessions.delete(sessionId);

      // Notify others
      socket.to(`session:${sessionId}`).emit(SOCKET_EVENTS.SESSION_UPDATED, {
        sessionId,
        status: 'ACTIVE',
        availableSeats: undefined, // Could fetch actual count if needed
      });

      console.log(
        `[Booking] User ${userId} left session ${sessionId} (${usersOnline} online, released ${releasedSeats.length} seats)`
      );
    } catch (error) {
      console.error(`[Booking] Leave session error for ${sessionId}:`, error);
    }
  }
}

// ============================================================================
// BROADCAST HELPERS (for use outside socket handlers)
// ============================================================================

export function createBroadcastHelpers(io: BookingServer) {
  const bookingsNamespace = io.of('/bookings');

  return {
    /**
     * Broadcast seat released event (e.g., from expiration job)
     */
    broadcastSeatReleased(sessionId: string, seatId: string, reason: 'timeout' | 'payment_failed') {
      bookingsNamespace.to(`session:${sessionId}`).emit(SOCKET_EVENTS.SEAT_RELEASED, {
        seatId,
        reason,
      });
    },

    /**
     * Broadcast booking confirmed event
     */
    broadcastBookingConfirmed(
      sessionId: string,
      userId: string,
      booking: {
        bookingId: string;
        seats: Array<{ seatId: string; row: string; number: string; section: string; price: number }>;
        totalPrice: number;
      }
    ) {
      // Notify all in session that seats are now occupied
      for (const seat of booking.seats) {
        bookingsNamespace.to(`session:${sessionId}`).emit(SOCKET_EVENTS.SEAT_RESERVED, {
          seatId: seat.seatId,
          reservedBy: 'another_user',
          expiresAt: 0, // Permanent
        });
      }

      // Could also emit to specific user if we track user->socket mapping
    },

    /**
     * Broadcast session status update
     */
    broadcastSessionUpdated(sessionId: string, status: 'ACTIVE' | 'SOLD_OUT' | 'CANCELLED' | 'COMPLETED') {
      bookingsNamespace.to(`session:${sessionId}`).emit(SOCKET_EVENTS.SESSION_UPDATED, {
        sessionId,
        status,
      });
    },

    /**
     * Get count of users in a session
     */
    async getUsersInSession(sessionId: string): Promise<number> {
      const sockets = await bookingsNamespace.in(`session:${sessionId}`).fetchSockets();
      return sockets.length;
    },
  };
}

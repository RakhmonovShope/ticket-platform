import { PrismaClient, SeatStatus, BookingStatus, SessionStatus } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { redis, RedisKeys, type SeatReservation, type CartItem } from '../../services/redis.service.js';
import {
  SeatNotAvailableError,
  SeatAlreadySelectedError,
  SeatNotFoundError,
  SessionNotFoundError,
  SessionNotActiveError,
  BookingNotFoundError,
  MaxSeatsExceededError,
  RateLimitExceededError,
  ConflictError,
} from './booking.errors.js';
import { BOOKING_CONFIG } from './booking.types.js';

// ============================================================================
// PRISMA CLIENT SINGLETON
// ============================================================================

const prisma = new PrismaClient();

// ============================================================================
// BOOKING SERVICE
// ============================================================================

class BookingService {
  private static instance: BookingService;

  private constructor() {}

  public static getInstance(): BookingService {
    if (!BookingService.instance) {
      BookingService.instance = new BookingService();
    }
    return BookingService.instance;
  }

  // ===========================================================================
  // SESSION OPERATIONS
  // ===========================================================================

  /**
   * Get session with seats and their current status
   */
  async getSessionState(sessionId: string) {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        seats: {
          select: {
            id: true,
            row: true,
            number: true,
            section: true,
            x: true,
            y: true,
            width: true,
            height: true,
            shape: true,
            rotation: true,
            status: true,
          },
        },
        venue: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!session) {
      throw new SessionNotFoundError(sessionId);
    }

    // Get real-time reservation data from Redis
    const seatPattern = RedisKeys.seatPattern(sessionId);
    const reservedKeys = await redis.scanKeys(seatPattern);

    const reservations = new Map<string, SeatReservation>();
    for (const key of reservedKeys) {
      const seatId = key.split(':').pop()!;
      const reservation = await redis.getJSON<SeatReservation>(key);
      if (reservation) {
        reservations.set(seatId, reservation);
      }
    }

    // Get online users count
    const usersOnline = await redis.scard(RedisKeys.sessionUsers(sessionId));

    // Merge DB status with real-time Redis data
    const seats = session.seats.map((seat) => {
      const reservation = reservations.get(seat.id);
      return {
        ...seat,
        reservedBy: reservation?.userId,
        expiresAt: reservation
          ? reservation.timestamp + BOOKING_CONFIG.SELECTION_TTL_SECONDS * 1000
          : undefined,
      };
    });

    return {
      sessionId: session.id,
      status: session.status,
      venue: session.venue,
      seats,
      usersOnline,
    };
  }

  /**
   * Check if session is active for booking
   */
  async validateSession(sessionId: string): Promise<void> {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      select: { id: true, status: true, isActive: true },
    });

    if (!session) {
      throw new SessionNotFoundError(sessionId);
    }

    if (!session.isActive || session.status !== SessionStatus.ACTIVE) {
      throw new SessionNotActiveError(sessionId, session.status);
    }
  }

  // ===========================================================================
  // SEAT SELECTION (TEMPORARY HOLD)
  // ===========================================================================

  /**
   * Select a seat temporarily (5 min hold)
   */
  async selectSeat(
    sessionId: string,
    seatId: string,
    userId: string,
    socketId: string
  ): Promise<{ success: boolean; expiresAt: number }> {
    // Validate session
    await this.validateSession(sessionId);

    // Check seat exists and is available in DB
    const seat = await prisma.seat.findUnique({
      where: { id: seatId },
      select: { id: true, status: true, sessionId: true },
    });

    if (!seat) {
      throw new SeatNotFoundError(seatId);
    }

    if (seat.sessionId !== sessionId) {
      throw new SeatNotFoundError(seatId);
    }

    if (seat.status !== SeatStatus.AVAILABLE) {
      throw new SeatNotAvailableError(seatId, seat.status);
    }

    // Check Redis for existing reservation
    const redisKey = RedisKeys.seat(sessionId, seatId);
    const existingReservation = await redis.getJSON<SeatReservation>(redisKey);

    if (existingReservation && existingReservation.userId !== userId) {
      throw new SeatAlreadySelectedError(seatId, 'another_user');
    }

    // Try to set the reservation (atomic operation)
    const reservation: SeatReservation = {
      userId,
      timestamp: Date.now(),
      socketId,
    };

    const wasSet = await redis.setNX(
      redisKey,
      JSON.stringify(reservation),
      BOOKING_CONFIG.SELECTION_TTL_SECONDS
    );

    if (!wasSet) {
      // Key was set by someone else between our check and set
      const currentReservation = await redis.getJSON<SeatReservation>(redisKey);
      if (currentReservation && currentReservation.userId !== userId) {
        throw new SeatAlreadySelectedError(seatId, 'another_user');
      }
      // It's our own reservation, update the TTL
      await redis.setJSON(redisKey, reservation, BOOKING_CONFIG.SELECTION_TTL_SECONDS);
    }

    const expiresAt = reservation.timestamp + BOOKING_CONFIG.SELECTION_TTL_SECONDS * 1000;

    return { success: true, expiresAt };
  }

  /**
   * Release a selected seat
   */
  async releaseSeat(
    sessionId: string,
    seatId: string,
    userId: string
  ): Promise<boolean> {
    const redisKey = RedisKeys.seat(sessionId, seatId);
    const reservation = await redis.getJSON<SeatReservation>(redisKey);

    if (!reservation) {
      return false; // Already released
    }

    // Only the user who selected can release
    if (reservation.userId !== userId) {
      return false;
    }

    await redis.del(redisKey);
    return true;
  }

  /**
   * Release multiple seats
   */
  async releaseSeats(
    sessionId: string,
    seatIds: string[],
    userId: string
  ): Promise<string[]> {
    const releasedSeats: string[] = [];

    for (const seatId of seatIds) {
      const released = await this.releaseSeat(sessionId, seatId, userId);
      if (released) {
        releasedSeats.push(seatId);
      }
    }

    return releasedSeats;
  }

  // ===========================================================================
  // SEAT RESERVATION (CREATE BOOKING)
  // ===========================================================================

  /**
   * Reserve seats and create a pending booking
   */
  async reserveSeats(
    sessionId: string,
    seatIds: string[],
    userId: string,
    socketId: string
  ): Promise<{
    bookingId: string;
    seats: Array<{ seatId: string; row: string; number: string; section: string; price: number }>;
    totalPrice: number;
    expiresAt: Date;
  }> {
    // Validate seat count
    if (seatIds.length > BOOKING_CONFIG.MAX_SEATS_PER_BOOKING) {
      throw new MaxSeatsExceededError(BOOKING_CONFIG.MAX_SEATS_PER_BOOKING, seatIds.length);
    }

    // Validate session
    await this.validateSession(sessionId);

    // Check all seats are available and get their data
    const seats = await prisma.seat.findMany({
      where: {
        id: { in: seatIds },
        sessionId,
      },
      include: {
        TariffSeat: {
          include: {
            tariff: true,
          },
        },
      },
    });

    if (seats.length !== seatIds.length) {
      const foundIds = seats.map((s) => s.id);
      const missingId = seatIds.find((id) => !foundIds.includes(id));
      throw new SeatNotFoundError(missingId || 'unknown');
    }

    // Check availability
    for (const seat of seats) {
      if (seat.status !== SeatStatus.AVAILABLE) {
        throw new SeatNotAvailableError(seat.id, seat.status);
      }

      // Check Redis for conflicting reservations by other users
      const redisKey = RedisKeys.seat(sessionId, seat.id);
      const reservation = await redis.getJSON<SeatReservation>(redisKey);
      if (reservation && reservation.userId !== userId) {
        throw new SeatAlreadySelectedError(seat.id, 'another_user');
      }
    }

    // Calculate total price
    const seatDetails = seats.map((seat) => {
      const tariffSeat = seat.TariffSeat[0];
      const price = tariffSeat?.tariff?.price?.toNumber() ?? 0;
      return {
        seatId: seat.id,
        row: seat.row,
        number: seat.number,
        section: seat.section,
        price,
      };
    });

    const totalPrice = seatDetails.reduce((sum, s) => sum + s.price, 0);
    const expiresAt = new Date(Date.now() + BOOKING_CONFIG.RESERVATION_TTL_SECONDS * 1000);

    // Create booking in transaction
    const booking = await prisma.$transaction(async (tx) => {
      // Double-check seat availability with row-level lock
      const lockedSeats = await tx.$queryRaw<{ id: string; status: string }[]>`
        SELECT id, status FROM "Seat"
        WHERE id = ANY(${seatIds})
        FOR UPDATE
      `;

      for (const lockedSeat of lockedSeats) {
        if (lockedSeat.status !== SeatStatus.AVAILABLE) {
          throw new SeatNotAvailableError(lockedSeat.id, lockedSeat.status);
        }
      }

      // Create bookings for each seat (one booking per seat as per schema)
      const bookingIds: string[] = [];

      for (const seatDetail of seatDetails) {
        const newBooking = await tx.booking.create({
          data: {
            sessionId,
            seatId: seatDetail.seatId,
            userId,
            status: BookingStatus.PENDING,
            totalPrice: seatDetail.price,
            expiresAt,
          },
        });
        bookingIds.push(newBooking.id);
      }

      // Update seats to RESERVED
      await tx.seat.updateMany({
        where: { id: { in: seatIds } },
        data: { status: SeatStatus.RESERVED },
      });

      // Return the first booking ID as the group ID
      return {
        id: bookingIds[0],
        bookingIds,
      };
    });

    // Update Redis reservations with booking info
    for (const seatId of seatIds) {
      const redisKey = RedisKeys.seat(sessionId, seatId);
      const reservation: SeatReservation = {
        userId,
        timestamp: Date.now(),
        bookingId: booking.id,
        socketId,
      };
      await redis.setJSON(redisKey, reservation, BOOKING_CONFIG.RESERVATION_TTL_SECONDS);
    }

    return {
      bookingId: booking.id,
      seats: seatDetails,
      totalPrice,
      expiresAt,
    };
  }

  // ===========================================================================
  // BOOKING CONFIRMATION (AFTER PAYMENT)
  // ===========================================================================

  /**
   * Confirm booking after successful payment
   */
  async confirmBooking(
    bookingId: string,
    userId: string,
    paymentId: string
  ): Promise<{
    bookingId: string;
    seats: Array<{ seatId: string; row: string; number: string; section: string; price: number }>;
    totalPrice: number;
  }> {
    // Get booking
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        seat: {
          include: {
            TariffSeat: {
              include: {
                tariff: true,
              },
            },
          },
        },
        session: true,
      },
    });

    if (!booking) {
      throw new BookingNotFoundError(bookingId);
    }

    if (booking.userId !== userId) {
      throw new ConflictError('Booking does not belong to this user');
    }

    if (booking.status === BookingStatus.CONFIRMED) {
      // Already confirmed
      return {
        bookingId: booking.id,
        seats: [{
          seatId: booking.seat.id,
          row: booking.seat.row,
          number: booking.seat.number,
          section: booking.seat.section,
          price: booking.totalPrice.toNumber(),
        }],
        totalPrice: booking.totalPrice.toNumber(),
      };
    }

    if (booking.status !== BookingStatus.PENDING) {
      throw new ConflictError(`Booking status is ${booking.status}, cannot confirm`);
    }

    // Update booking and seat in transaction
    await prisma.$transaction(async (tx) => {
      await tx.booking.update({
        where: { id: bookingId },
        data: {
          status: BookingStatus.CONFIRMED,
        },
      });

      await tx.seat.update({
        where: { id: booking.seatId },
        data: { status: SeatStatus.OCCUPIED },
      });
    });

    // Remove from Redis (no longer needs TTL tracking)
    await redis.del(RedisKeys.seat(booking.sessionId, booking.seatId));

    const tariffSeat = booking.seat.TariffSeat[0];
    const price = tariffSeat?.tariff?.price?.toNumber() ?? booking.totalPrice.toNumber();

    return {
      bookingId: booking.id,
      seats: [{
        seatId: booking.seat.id,
        row: booking.seat.row,
        number: booking.seat.number,
        section: booking.seat.section,
        price,
      }],
      totalPrice: booking.totalPrice.toNumber(),
    };
  }

  // ===========================================================================
  // BOOKING CANCELLATION
  // ===========================================================================

  /**
   * Cancel a booking and release seats
   */
  async cancelBooking(
    bookingId: string,
    userId: string,
    reason: 'manual' | 'timeout' | 'payment_failed' = 'manual'
  ): Promise<{ seatId: string; sessionId: string }> {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { seat: true },
    });

    if (!booking) {
      throw new BookingNotFoundError(bookingId);
    }

    if (booking.userId !== userId) {
      throw new ConflictError('Booking does not belong to this user');
    }

    if (booking.status === BookingStatus.CONFIRMED) {
      throw new ConflictError('Cannot cancel a confirmed booking');
    }

    // Update booking and seat in transaction
    await prisma.$transaction(async (tx) => {
      await tx.booking.update({
        where: { id: bookingId },
        data: {
          status: BookingStatus.CANCELLED,
        },
      });

      await tx.seat.update({
        where: { id: booking.seatId },
        data: { status: SeatStatus.AVAILABLE },
      });
    });

    // Remove from Redis
    await redis.del(RedisKeys.seat(booking.sessionId, booking.seatId));

    return {
      seatId: booking.seatId,
      sessionId: booking.sessionId,
    };
  }

  // ===========================================================================
  // EXPIRATION HANDLING
  // ===========================================================================

  /**
   * Check and expire old reservations
   * Called by cron job
   */
  async processExpiredReservations(): Promise<Array<{ bookingId: string; seatId: string; sessionId: string }>> {
    const expiredBookings = await prisma.booking.findMany({
      where: {
        status: BookingStatus.PENDING,
        expiresAt: {
          lt: new Date(),
        },
      },
      include: {
        seat: true,
      },
    });

    const results: Array<{ bookingId: string; seatId: string; sessionId: string }> = [];

    for (const booking of expiredBookings) {
      try {
        await prisma.$transaction(async (tx) => {
          await tx.booking.update({
            where: { id: booking.id },
            data: { status: BookingStatus.EXPIRED },
          });

          await tx.seat.update({
            where: { id: booking.seatId },
            data: { status: SeatStatus.AVAILABLE },
          });
        });

        // Remove from Redis
        await redis.del(RedisKeys.seat(booking.sessionId, booking.seatId));

        results.push({
          bookingId: booking.id,
          seatId: booking.seatId,
          sessionId: booking.sessionId,
        });
      } catch (error) {
        console.error(`Failed to expire booking ${booking.id}:`, error);
      }
    }

    return results;
  }

  /**
   * Process expired seat selections (Redis TTL handled automatically)
   * This scans for any orphaned selections
   */
  async cleanupOrphanedSelections(sessionId: string): Promise<string[]> {
    const seatPattern = RedisKeys.seatPattern(sessionId);
    const keys = await redis.scanKeys(seatPattern);
    const orphaned: string[] = [];

    for (const key of keys) {
      const ttl = await redis.ttl(key);
      if (ttl === -2) {
        // Key doesn't exist (already expired)
        continue;
      }
      if (ttl === -1) {
        // Key has no TTL (orphaned)
        const seatId = key.split(':').pop()!;
        await redis.del(key);
        orphaned.push(seatId);
      }
    }

    return orphaned;
  }

  // ===========================================================================
  // RATE LIMITING
  // ===========================================================================

  /**
   * Check and increment rate limit
   */
  async checkRateLimit(userId: string, action: string = 'select'): Promise<{ allowed: boolean; retryAfter?: number }> {
    const key = RedisKeys.rateLimit(userId, action);
    const count = await redis.incrementWithTTL(key, BOOKING_CONFIG.RATE_LIMIT_WINDOW_SECONDS);

    if (count > BOOKING_CONFIG.RATE_LIMIT_SELECTIONS_PER_MINUTE) {
      const ttl = await redis.ttl(key);
      return { allowed: false, retryAfter: ttl > 0 ? ttl : BOOKING_CONFIG.RATE_LIMIT_WINDOW_SECONDS };
    }

    return { allowed: true };
  }

  // ===========================================================================
  // USER SESSION TRACKING
  // ===========================================================================

  /**
   * Add user to session (for online user count)
   */
  async joinSession(sessionId: string, socketId: string): Promise<number> {
    await redis.sadd(RedisKeys.sessionUsers(sessionId), socketId);
    return redis.scard(RedisKeys.sessionUsers(sessionId));
  }

  /**
   * Remove user from session
   */
  async leaveSession(sessionId: string, socketId: string): Promise<number> {
    await redis.srem(RedisKeys.sessionUsers(sessionId), socketId);
    return redis.scard(RedisKeys.sessionUsers(sessionId));
  }

  /**
   * Get seats selected by a specific socket (for cleanup on disconnect)
   */
  async getSocketSelections(sessionId: string, socketId: string): Promise<string[]> {
    const seatPattern = RedisKeys.seatPattern(sessionId);
    const keys = await redis.scanKeys(seatPattern);
    const selectedSeats: string[] = [];

    for (const key of keys) {
      const reservation = await redis.getJSON<SeatReservation>(key);
      if (reservation?.socketId === socketId && !reservation.bookingId) {
        const seatId = key.split(':').pop()!;
        selectedSeats.push(seatId);
      }
    }

    return selectedSeats;
  }

  /**
   * Release all selections for a socket (on disconnect)
   */
  async releaseSocketSelections(sessionId: string, socketId: string): Promise<string[]> {
    const seatIds = await this.getSocketSelections(sessionId, socketId);
    
    for (const seatId of seatIds) {
      await redis.del(RedisKeys.seat(sessionId, seatId));
    }

    return seatIds;
  }
}

// Export singleton instance
export const bookingService = BookingService.getInstance();

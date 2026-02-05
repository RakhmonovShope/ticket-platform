import { PrismaClient, SessionStatus, SeatStatus, BookingStatus, Prisma } from '@prisma/client';
import type {
  CreateSessionInput,
  UpdateSessionInput,
  SessionQueryInput,
  DuplicateSessionInput,
  SessionValidationResult,
  SessionDetailResponse,
  SeatWithTariffResponse,
} from './session.types.js';
import {
  SessionNotFoundError,
  VenueNotFoundError,
  InvalidStatusTransitionError,
  SessionOverlapError,
  SeatsWithoutTariffError,
  SessionNotDraftError,
  SessionNotActiveError,
  CannotCancelSessionError,
} from './session.errors.js';

// ============================================================================
// PRISMA CLIENT
// ============================================================================

const prisma = new PrismaClient();

// ============================================================================
// SESSION SERVICE
// ============================================================================

class SessionService {
  private static instance: SessionService;

  private constructor() {}

  public static getInstance(): SessionService {
    if (!SessionService.instance) {
      SessionService.instance = new SessionService();
    }
    return SessionService.instance;
  }

  // ===========================================================================
  // CREATE SESSION
  // ===========================================================================

  async create(input: CreateSessionInput) {
    const { venueId, name, description, startTime, endTime } = input;

    // Verify venue exists and is active
    const venue = await prisma.venue.findUnique({
      where: { id: venueId },
      include: { _count: { select: { sessions: true } } },
    });

    if (!venue || !venue.isActive) {
      throw new VenueNotFoundError(venueId);
    }

    // Check for overlapping sessions
    await this.checkOverlap(venueId, new Date(startTime), new Date(endTime));

    // Create session and duplicate seats in transaction
    const session = await prisma.$transaction(async (tx) => {
      // Create the session
      const newSession = await tx.session.create({
        data: {
          venueId,
          name,
          description,
          startTime: new Date(startTime),
          endTime: new Date(endTime),
          status: SessionStatus.DRAFT,
          isActive: true,
        },
      });

      // Get seats from venue schema and create them for this session
      const venueSchema = venue.schema as {
        seats?: Array<{
          id: string;
          row: string;
          number: string;
          section: string;
          x: number;
          y: number;
          width: number;
          height: number;
          shape: string;
          rotation: number;
        }>;
      };

      if (venueSchema?.seats && venueSchema.seats.length > 0) {
        await tx.seat.createMany({
          data: venueSchema.seats.map((seat) => ({
            sessionId: newSession.id,
            row: seat.row,
            number: seat.number,
            section: seat.section,
            x: seat.x,
            y: seat.y,
            width: seat.width || 30,
            height: seat.height || 30,
            shape: seat.shape || 'RECTANGLE',
            rotation: seat.rotation || 0,
            status: SeatStatus.AVAILABLE,
          })),
        });
      }

      return newSession;
    });

    return this.findById(session.id);
  }

  // ===========================================================================
  // FIND SESSIONS
  // ===========================================================================

  async findAll(query: SessionQueryInput) {
    const { venueId, status, fromDate, toDate, page, limit } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.SessionWhereInput = {
      isActive: true,
      ...(venueId && { venueId }),
      ...(status && { status }),
      ...(fromDate && { startTime: { gte: new Date(fromDate) } }),
      ...(toDate && { endTime: { lte: new Date(toDate) } }),
    };

    const [sessions, total] = await Promise.all([
      prisma.session.findMany({
        where,
        include: {
          venue: {
            select: { id: true, name: true, capacity: true },
          },
          _count: {
            select: { seats: true, tariffs: true, bookings: true },
          },
        },
        orderBy: { startTime: 'asc' },
        skip,
        take: limit,
      }),
      prisma.session.count({ where }),
    ]);

    return {
      data: sessions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id: string): Promise<SessionDetailResponse> {
    const session = await prisma.session.findUnique({
      where: { id },
      include: {
        venue: {
          select: {
            id: true,
            name: true,
            address: true,
            capacity: true,
            schema: true,
          },
        },
        tariffs: {
          where: { isActive: true },
          include: {
            _count: { select: { TariffSeat: true } },
          },
        },
        seats: {
          include: {
            TariffSeat: {
              include: {
                tariff: {
                  select: { id: true, name: true, price: true, color: true },
                },
              },
            },
          },
        },
        bookings: {
          where: { status: { in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] } },
        },
      },
    });

    if (!session) {
      throw new SessionNotFoundError(id);
    }

    // Calculate stats
    const stats = this.calculateSessionStats(session);

    // Transform seats to include tariff info
    const seats: SeatWithTariffResponse[] = session.seats.map((seat) => ({
      id: seat.id,
      row: seat.row,
      number: seat.number,
      section: seat.section,
      x: seat.x,
      y: seat.y,
      width: seat.width,
      height: seat.height,
      shape: seat.shape,
      rotation: seat.rotation,
      status: seat.status,
      tariff: seat.TariffSeat[0]?.tariff || null,
    }));

    return {
      id: session.id,
      venueId: session.venueId,
      name: session.name,
      description: session.description,
      startTime: session.startTime.toISOString(),
      endTime: session.endTime.toISOString(),
      status: session.status,
      isActive: session.isActive,
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
      venue: {
        id: session.venue.id,
        name: session.venue.name,
        address: session.venue.address,
        capacity: session.venue.capacity,
        schema: session.venue.schema,
      },
      tariffs: session.tariffs.map((t) => ({
        id: t.id,
        sessionId: t.sessionId,
        name: t.name,
        price: t.price.toNumber(),
        color: t.color,
        description: t.description,
        isActive: t.isActive,
        _count: t._count,
      })),
      seats,
      stats,
    };
  }

  // ===========================================================================
  // UPDATE SESSION
  // ===========================================================================

  async update(id: string, input: UpdateSessionInput) {
    const session = await prisma.session.findUnique({ where: { id } });

    if (!session) {
      throw new SessionNotFoundError(id);
    }

    // Only allow updates in DRAFT status
    if (session.status !== SessionStatus.DRAFT) {
      throw new SessionNotDraftError(session.status);
    }

    // Check for overlaps if time is being changed
    if (input.startTime || input.endTime) {
      const newStart = input.startTime ? new Date(input.startTime) : session.startTime;
      const newEnd = input.endTime ? new Date(input.endTime) : session.endTime;
      await this.checkOverlap(session.venueId, newStart, newEnd, id);
    }

    await prisma.session.update({
      where: { id },
      data: {
        ...(input.name && { name: input.name }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.startTime && { startTime: new Date(input.startTime) }),
        ...(input.endTime && { endTime: new Date(input.endTime) }),
      },
    });

    return this.findById(id);
  }

  // ===========================================================================
  // PUBLISH SESSION
  // ===========================================================================

  async publish(id: string) {
    const session = await prisma.session.findUnique({
      where: { id },
      include: {
        seats: {
          include: { TariffSeat: true },
        },
      },
    });

    if (!session) {
      throw new SessionNotFoundError(id);
    }

    if (session.status !== SessionStatus.DRAFT) {
      throw new InvalidStatusTransitionError(session.status, SessionStatus.ACTIVE);
    }

    // Validate all seats have tariffs
    const validation = await this.validateForPublish(session);
    if (!validation.isValid) {
      throw new SeatsWithoutTariffError(
        session.seats.filter((s) => s.TariffSeat.length === 0).length
      );
    }

    await prisma.session.update({
      where: { id },
      data: { status: SessionStatus.ACTIVE },
    });

    return this.findById(id);
  }

  // ===========================================================================
  // CANCEL SESSION
  // ===========================================================================

  async cancel(id: string, reason?: string) {
    const session = await prisma.session.findUnique({
      where: { id },
      include: {
        bookings: {
          where: {
            status: { in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] },
          },
        },
      },
    });

    if (!session) {
      throw new SessionNotFoundError(id);
    }

    if (session.status === SessionStatus.COMPLETED) {
      throw new CannotCancelSessionError('Session has already completed');
    }

    if (session.status === SessionStatus.CANCELLED) {
      throw new CannotCancelSessionError('Session is already cancelled');
    }

    // Cancel in transaction - update session and all bookings
    await prisma.$transaction(async (tx) => {
      // Update session status
      await tx.session.update({
        where: { id },
        data: { status: SessionStatus.CANCELLED },
      });

      // Cancel all pending/confirmed bookings
      if (session.bookings.length > 0) {
        await tx.booking.updateMany({
          where: {
            sessionId: id,
            status: { in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] },
          },
          data: { status: BookingStatus.CANCELLED },
        });

        // Release all seats
        await tx.seat.updateMany({
          where: {
            sessionId: id,
            status: { in: [SeatStatus.RESERVED, SeatStatus.OCCUPIED] },
          },
          data: { status: SeatStatus.AVAILABLE },
        });
      }
    });

    return this.findById(id);
  }

  // ===========================================================================
  // DUPLICATE SESSION
  // ===========================================================================

  async duplicate(id: string, input: DuplicateSessionInput) {
    const originalSession = await prisma.session.findUnique({
      where: { id },
      include: {
        seats: true,
        tariffs: {
          include: { TariffSeat: true },
        },
      },
    });

    if (!originalSession) {
      throw new SessionNotFoundError(id);
    }

    // Check for overlaps
    await this.checkOverlap(
      originalSession.venueId,
      new Date(input.startTime),
      new Date(input.endTime)
    );

    const newSession = await prisma.$transaction(async (tx) => {
      // Create new session
      const session = await tx.session.create({
        data: {
          venueId: originalSession.venueId,
          name: input.name,
          description: originalSession.description,
          startTime: new Date(input.startTime),
          endTime: new Date(input.endTime),
          status: SessionStatus.DRAFT,
          isActive: true,
        },
      });

      // Create seat ID mapping (old ID -> new ID)
      const seatIdMap = new Map<string, string>();

      // Duplicate seats
      for (const seat of originalSession.seats) {
        const newSeat = await tx.seat.create({
          data: {
            sessionId: session.id,
            row: seat.row,
            number: seat.number,
            section: seat.section,
            x: seat.x,
            y: seat.y,
            width: seat.width,
            height: seat.height,
            shape: seat.shape,
            rotation: seat.rotation,
            status: SeatStatus.AVAILABLE,
          },
        });
        seatIdMap.set(seat.id, newSeat.id);
      }

      // Duplicate tariffs if requested
      if (input.copyTariffs) {
        for (const tariff of originalSession.tariffs) {
          const newTariff = await tx.tariff.create({
            data: {
              sessionId: session.id,
              name: tariff.name,
              price: tariff.price,
              color: tariff.color,
              description: tariff.description,
              isActive: tariff.isActive,
            },
          });

          // Duplicate tariff-seat assignments
          for (const tariffSeat of tariff.TariffSeat) {
            const newSeatId = seatIdMap.get(tariffSeat.seatId);
            if (newSeatId) {
              await tx.tariffSeat.create({
                data: {
                  tariffId: newTariff.id,
                  seatId: newSeatId,
                },
              });
            }
          }
        }
      }

      return session;
    });

    return this.findById(newSession.id);
  }

  // ===========================================================================
  // SOFT DELETE
  // ===========================================================================

  async delete(id: string) {
    const session = await prisma.session.findUnique({ where: { id } });

    if (!session) {
      throw new SessionNotFoundError(id);
    }

    // Only allow deletion of DRAFT or CANCELLED sessions
    if (session.status !== SessionStatus.DRAFT && session.status !== SessionStatus.CANCELLED) {
      throw new CannotCancelSessionError(
        `Cannot delete session with status ${session.status}. Only DRAFT or CANCELLED sessions can be deleted.`
      );
    }

    await prisma.session.update({
      where: { id },
      data: { isActive: false },
    });
  }

  // ===========================================================================
  // AUTO-COMPLETE SESSIONS
  // ===========================================================================

  async processCompletedSessions() {
    const now = new Date();

    const completedSessions = await prisma.session.updateMany({
      where: {
        status: SessionStatus.ACTIVE,
        endTime: { lt: now },
      },
      data: { status: SessionStatus.COMPLETED },
    });

    return completedSessions.count;
  }

  // ===========================================================================
  // CHECK SOLD OUT
  // ===========================================================================

  async checkAndUpdateSoldOut(sessionId: string) {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        seats: { where: { status: SeatStatus.AVAILABLE } },
      },
    });

    if (!session) return;

    if (session.status === SessionStatus.ACTIVE && session.seats.length === 0) {
      await prisma.session.update({
        where: { id: sessionId },
        data: { status: SessionStatus.SOLD_OUT },
      });
    }
  }

  // ===========================================================================
  // HELPERS
  // ===========================================================================

  private async checkOverlap(
    venueId: string,
    startTime: Date,
    endTime: Date,
    excludeSessionId?: string
  ): Promise<void> {
    const overlapping = await prisma.session.findFirst({
      where: {
        venueId,
        isActive: true,
        status: { notIn: [SessionStatus.CANCELLED] },
        ...(excludeSessionId && { id: { not: excludeSessionId } }),
        OR: [
          // New session starts during existing session
          { startTime: { lte: startTime }, endTime: { gt: startTime } },
          // New session ends during existing session
          { startTime: { lt: endTime }, endTime: { gte: endTime } },
          // New session completely contains existing session
          { startTime: { gte: startTime }, endTime: { lte: endTime } },
        ],
      },
    });

    if (overlapping) {
      throw new SessionOverlapError(venueId, overlapping.id);
    }
  }

  private async validateForPublish(session: {
    seats: Array<{ TariffSeat: unknown[] }>;
  }): Promise<SessionValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check all seats have tariffs
    const seatsWithoutTariff = session.seats.filter((s) => s.TariffSeat.length === 0);
    if (seatsWithoutTariff.length > 0) {
      errors.push(`${seatsWithoutTariff.length} seats do not have a tariff assigned`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  private calculateSessionStats(session: {
    seats: Array<{ status: string; TariffSeat: Array<{ tariff: { price: Prisma.Decimal } }> }>;
    bookings: Array<{ status: string; totalPrice: Prisma.Decimal }>;
  }) {
    const totalSeats = session.seats.length;
    const availableSeats = session.seats.filter((s) => s.status === SeatStatus.AVAILABLE).length;
    const reservedSeats = session.seats.filter((s) => s.status === SeatStatus.RESERVED).length;
    const occupiedSeats = session.seats.filter((s) => s.status === SeatStatus.OCCUPIED).length;
    const seatsWithTariff = session.seats.filter((s) => s.TariffSeat.length > 0).length;
    const seatsWithoutTariff = totalSeats - seatsWithTariff;

    // Calculate potential revenue (sum of tariff prices for all seats)
    const potentialRevenue = session.seats.reduce((sum, seat) => {
      const tariff = seat.TariffSeat[0]?.tariff;
      return sum + (tariff ? tariff.price.toNumber() : 0);
    }, 0);

    // Calculate confirmed revenue
    const confirmedRevenue = session.bookings
      .filter((b) => b.status === BookingStatus.CONFIRMED)
      .reduce((sum, b) => sum + b.totalPrice.toNumber(), 0);

    return {
      totalSeats,
      availableSeats,
      reservedSeats,
      occupiedSeats,
      seatsWithTariff,
      seatsWithoutTariff,
      revenue: {
        potential: potentialRevenue,
        confirmed: confirmedRevenue,
      },
    };
  }
}

export const sessionService = SessionService.getInstance();

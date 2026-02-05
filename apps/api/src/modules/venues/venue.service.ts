import { prisma } from '@repo/database';
import type { Prisma } from '@repo/database';
import {
  VenueNotFoundError,
  VenueHasActiveSessionsError,
  VenueHasSessionHistoryError,
  InvalidVenueSchemaError,
  SchemaErrorCodes,
  type SchemaError,
} from './venue.errors.js';
import {
  seatsOverlap,
  type CreateVenueInput,
  type UpdateVenueInput,
  type VenueQuery,
  type VenueSchemaType,
  type VenueWithSessionCount,
  type VenueWithSessions,
  type SchemaValidationResult,
  type SeatDefinition,
} from './venue.types.js';

export class VenueService {
  /**
   * Create a new venue
   * - Validates schema (bounds, overlaps, references)
   * - Sets capacity = seats.length
   */
  async create(data: CreateVenueInput) {
    // Validate schema with detailed checks
    const validation = this.validateSchema(data.schema);
    if (!validation.valid) {
      throw new InvalidVenueSchemaError(validation.errors);
    }

    // Calculate capacity from seats
    const capacity = data.schema.seats.length;

    const venue = await prisma.venue.create({
      data: {
        name: data.name,
        address: data.address,
        description: data.description,
        schema: data.schema as Prisma.InputJsonValue,
        capacity,
        isActive: data.isActive ?? true,
      },
    });

    return venue;
  }

  /**
   * Get all active venues with session count
   */
  async findAll(query: VenueQuery): Promise<{
    data: VenueWithSessionCount[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const { page, limit, search, isActive, sortBy, sortOrder } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.VenueWhereInput = {
      isActive: isActive ?? true,
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { address: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const orderBy: Prisma.VenueOrderByWithRelationInput = {
      [sortBy]: sortOrder,
    };

    const [venues, total] = await Promise.all([
      prisma.venue.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          _count: {
            select: {
              sessions: { where: { isActive: true } },
            },
          },
        },
      }),
      prisma.venue.count({ where }),
    ]);

    return {
      data: venues as VenueWithSessionCount[],
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get a venue by ID with recent sessions
   */
  async findById(id: string): Promise<VenueWithSessions> {
    const venue = await prisma.venue.findUnique({
      where: { id },
      include: {
        sessions: {
          where: { isActive: true },
          orderBy: { startTime: 'asc' },
          take: 10,
          select: {
            id: true,
            name: true,
            startTime: true,
            endTime: true,
            status: true,
          },
        },
      },
    });

    if (!venue) {
      throw new VenueNotFoundError(id);
    }

    return venue as VenueWithSessions;
  }

  /**
   * Update venue basic info (not schema)
   */
  async update(id: string, data: UpdateVenueInput) {
    const existing = await prisma.venue.findUnique({ where: { id } });
    if (!existing) {
      throw new VenueNotFoundError(id);
    }

    const venue = await prisma.venue.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.address !== undefined && { address: data.address }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
    });

    return venue;
  }

  /**
   * Full schema replacement with validation
   * - Validates all seats within bounds
   * - Checks for overlapping seats
   * - Updates capacity
   */
  async updateSchema(id: string, schema: VenueSchemaType) {
    const existing = await prisma.venue.findUnique({ where: { id } });
    if (!existing) {
      throw new VenueNotFoundError(id);
    }

    // Validate schema with detailed checks
    const validation = this.validateSchema(schema);
    if (!validation.valid) {
      throw new InvalidVenueSchemaError(validation.errors);
    }

    // Calculate new capacity
    const capacity = schema.seats.length;

    const venue = await prisma.venue.update({
      where: { id },
      data: {
        schema: schema as Prisma.InputJsonValue,
        capacity,
      },
    });

    return venue;
  }

  /**
   * Comprehensive schema validation
   * - At least 1 seat required
   * - All coordinates within canvas bounds
   * - No overlapping seats
   * - Valid section/seat references
   */
  validateSchema(schema: VenueSchemaType): SchemaValidationResult {
    const errors: SchemaError[] = [];
    const warnings: string[] = [];

    const { width: canvasWidth, height: canvasHeight, sections, seats, stage } = schema;

    // Track IDs for duplicate and reference checking
    const seatIdSet = new Set<string>();
    const sectionIdSet = new Set<string>();

    // Build maps for reference validation
    for (const section of sections) {
      sectionIdSet.add(section.id);
    }

    // =========================================================================
    // Validate minimum requirements
    // =========================================================================

    if (seats.length === 0) {
      errors.push({
        code: SchemaErrorCodes.NO_SEATS,
        message: 'Schema must have at least 1 seat',
        path: 'seats',
      });
    }

    if (sections.length === 0) {
      errors.push({
        code: SchemaErrorCodes.NO_SECTIONS,
        message: 'Schema must have at least 1 section',
        path: 'sections',
      });
    }

    // =========================================================================
    // Validate canvas size
    // =========================================================================

    if (canvasWidth <= 0 || canvasHeight <= 0) {
      errors.push({
        code: SchemaErrorCodes.INVALID_CANVAS_SIZE,
        message: `Canvas dimensions must be positive (got ${canvasWidth}x${canvasHeight})`,
        path: 'width/height',
      });
    }

    // =========================================================================
    // Validate sections (duplicate IDs)
    // =========================================================================

    const sectionIdCount = new Map<string, number>();
    for (const section of sections) {
      sectionIdCount.set(section.id, (sectionIdCount.get(section.id) || 0) + 1);
    }

    for (const [sectionId, count] of sectionIdCount) {
      if (count > 1) {
        errors.push({
          code: SchemaErrorCodes.DUPLICATE_SECTION_ID,
          message: `Duplicate section ID: "${sectionId}" appears ${count} times`,
          path: `sections`,
        });
      }
    }

    // =========================================================================
    // Validate each seat
    // =========================================================================

    for (let i = 0; i < seats.length; i++) {
      const seat = seats[i];
      const seatLabel = `${seat.row}-${seat.number}`;

      // Check for duplicate seat IDs
      if (seatIdSet.has(seat.id)) {
        errors.push({
          code: SchemaErrorCodes.DUPLICATE_SEAT_ID,
          message: `Duplicate seat ID: "${seat.id}"`,
          path: `seats[${i}].id`,
        });
      }
      seatIdSet.add(seat.id);

      // Validate seat is within canvas bounds
      const seatRight = seat.x + seat.width;
      const seatBottom = seat.y + seat.height;

      if (seat.x < 0 || seatRight > canvasWidth) {
        errors.push({
          code: SchemaErrorCodes.SEAT_OUT_OF_BOUNDS,
          message: `Seat "${seatLabel}" x-coordinate out of bounds: x=${seat.x}, width=${seat.width}, canvas width=${canvasWidth}`,
          path: `seats[${i}].x`,
        });
      }

      if (seat.y < 0 || seatBottom > canvasHeight) {
        errors.push({
          code: SchemaErrorCodes.SEAT_OUT_OF_BOUNDS,
          message: `Seat "${seatLabel}" y-coordinate out of bounds: y=${seat.y}, height=${seat.height}, canvas height=${canvasHeight}`,
          path: `seats[${i}].y`,
        });
      }

      // Validate seat references valid section
      if (!sectionIdSet.has(seat.section)) {
        errors.push({
          code: SchemaErrorCodes.INVALID_SECTION_REFERENCE,
          message: `Seat "${seatLabel}" references non-existent section: "${seat.section}"`,
          path: `seats[${i}].section`,
        });
      }
    }

    // =========================================================================
    // Validate section seatIds references
    // =========================================================================

    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      for (const seatId of section.seatIds) {
        if (!seatIdSet.has(seatId)) {
          errors.push({
            code: SchemaErrorCodes.INVALID_SEAT_REFERENCE,
            message: `Section "${section.name}" references non-existent seat: "${seatId}"`,
            path: `sections[${i}].seatIds`,
          });
        }
      }

      // Warning: section has no seats
      if (section.seatIds.length === 0) {
        warnings.push(`Section "${section.name}" has no seats assigned`);
      }
    }

    // =========================================================================
    // Check for overlapping seats (AABB collision)
    // =========================================================================

    const overlappingPairs = this.findOverlappingSeats(seats);
    for (const [seat1, seat2] of overlappingPairs) {
      errors.push({
        code: SchemaErrorCodes.SEATS_OVERLAP,
        message: `Seats "${seat1.row}-${seat1.number}" and "${seat2.row}-${seat2.number}" overlap at coordinates`,
        path: 'seats',
        seat1: seat1.id,
        seat2: seat2.id,
      });
    }

    // =========================================================================
    // Validate stage (if present)
    // =========================================================================

    if (stage) {
      const stageRight = stage.x + stage.width;
      const stageBottom = stage.y + stage.height;

      if (stage.x < 0 || stageRight > canvasWidth) {
        errors.push({
          code: SchemaErrorCodes.STAGE_OUT_OF_BOUNDS,
          message: `Stage x-coordinate out of bounds: x=${stage.x}, width=${stage.width}, canvas width=${canvasWidth}`,
          path: 'stage.x',
        });
      }

      if (stage.y < 0 || stageBottom > canvasHeight) {
        errors.push({
          code: SchemaErrorCodes.STAGE_OUT_OF_BOUNDS,
          message: `Stage y-coordinate out of bounds: y=${stage.y}, height=${stage.height}, canvas height=${canvasHeight}`,
          path: 'stage.y',
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      stats: {
        totalSeats: seats.length,
        totalSections: sections.length,
        canvasSize: { width: canvasWidth, height: canvasHeight },
      },
    };
  }

  /**
   * Find all overlapping seat pairs using AABB collision detection
   */
  private findOverlappingSeats(seats: SeatDefinition[]): [SeatDefinition, SeatDefinition][] {
    const overlapping: [SeatDefinition, SeatDefinition][] = [];

    for (let i = 0; i < seats.length; i++) {
      for (let j = i + 1; j < seats.length; j++) {
        const seat1 = seats[i];
        const seat2 = seats[j];

        if (seatsOverlap(seat1, seat2)) {
          overlapping.push([seat1, seat2]);
        }
      }
    }

    return overlapping;
  }

  /**
   * Soft delete (deactivate) a venue
   */
  async softDelete(id: string) {
    const existing = await prisma.venue.findUnique({
      where: { id },
      include: {
        sessions: {
          where: { status: { in: ['ACTIVE', 'SOLD_OUT'] } },
        },
      },
    });

    if (!existing) {
      throw new VenueNotFoundError(id);
    }

    if (existing.sessions.length > 0) {
      throw new VenueHasActiveSessionsError(id, existing.sessions.length);
    }

    await prisma.venue.update({
      where: { id },
      data: { isActive: false },
    });

    return { success: true, message: 'Venue deactivated successfully' };
  }

  /**
   * Hard delete (permanent) - only if no session history
   */
  async hardDelete(id: string) {
    const existing = await prisma.venue.findUnique({
      where: { id },
      include: {
        _count: { select: { sessions: true } },
      },
    });

    if (!existing) {
      throw new VenueNotFoundError(id);
    }

    if (existing._count.sessions > 0) {
      throw new VenueHasSessionHistoryError(id);
    }

    await prisma.venue.delete({ where: { id } });

    return { success: true, message: 'Venue permanently deleted' };
  }

  /**
   * Get venue statistics
   */
  async getStats(id: string) {
    const venue = await prisma.venue.findUnique({
      where: { id },
      include: {
        sessions: {
          select: {
            id: true,
            status: true,
            _count: { select: { bookings: true } },
          },
        },
      },
    });

    if (!venue) {
      throw new VenueNotFoundError(id);
    }

    return {
      venueId: id,
      venueName: venue.name,
      totalSessions: venue.sessions.length,
      activeSessions: venue.sessions.filter((s) => s.status === 'ACTIVE').length,
      completedSessions: venue.sessions.filter((s) => s.status === 'COMPLETED').length,
      cancelledSessions: venue.sessions.filter((s) => s.status === 'CANCELLED').length,
      totalBookings: venue.sessions.reduce((sum, s) => sum + s._count.bookings, 0),
      capacity: venue.capacity,
      isActive: venue.isActive,
    };
  }
}

// Export singleton instance
export const venueService = new VenueService();

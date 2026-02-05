import { PrismaClient, SessionStatus, Prisma } from '@prisma/client';
import type {
  CreateTariffInput,
  UpdateTariffInput,
  CreateMultipleTariffsInput,
  AssignSeatsToTariffInput,
  BulkAssignTariffInput,
  AutoAssignTariffInput,
  CreatePricingRuleInput,
} from './session.types.js';
import {
  SessionNotFoundError,
  TariffNotFoundError,
  SessionNotDraftError,
} from './session.errors.js';

// ============================================================================
// PRISMA CLIENT
// ============================================================================

const prisma = new PrismaClient();

// ============================================================================
// TARIFF SERVICE
// ============================================================================

class TariffService {
  private static instance: TariffService;

  private constructor() {}

  public static getInstance(): TariffService {
    if (!TariffService.instance) {
      TariffService.instance = new TariffService();
    }
    return TariffService.instance;
  }

  // ===========================================================================
  // CREATE TARIFF
  // ===========================================================================

  async create(sessionId: string, input: CreateTariffInput) {
    const session = await this.validateSessionForTariff(sessionId);

    const tariff = await prisma.tariff.create({
      data: {
        sessionId,
        name: input.name,
        price: new Prisma.Decimal(input.price),
        color: input.color,
        description: input.description,
        isActive: input.isActive,
      },
      include: {
        _count: { select: { TariffSeat: true } },
      },
    });

    return {
      id: tariff.id,
      sessionId: tariff.sessionId,
      name: tariff.name,
      price: tariff.price.toNumber(),
      color: tariff.color,
      description: tariff.description,
      isActive: tariff.isActive,
      _count: tariff._count,
    };
  }

  async createMultiple(sessionId: string, input: CreateMultipleTariffsInput) {
    const session = await this.validateSessionForTariff(sessionId);

    const tariffs = await prisma.$transaction(
      input.tariffs.map((t) =>
        prisma.tariff.create({
          data: {
            sessionId,
            name: t.name,
            price: new Prisma.Decimal(t.price),
            color: t.color,
            description: t.description,
            isActive: t.isActive,
          },
          include: {
            _count: { select: { TariffSeat: true } },
          },
        })
      )
    );

    return tariffs.map((tariff) => ({
      id: tariff.id,
      sessionId: tariff.sessionId,
      name: tariff.name,
      price: tariff.price.toNumber(),
      color: tariff.color,
      description: tariff.description,
      isActive: tariff.isActive,
      _count: tariff._count,
    }));
  }

  // ===========================================================================
  // UPDATE TARIFF
  // ===========================================================================

  async update(sessionId: string, tariffId: string, input: UpdateTariffInput) {
    await this.validateSessionForTariff(sessionId);

    const tariff = await prisma.tariff.findFirst({
      where: { id: tariffId, sessionId },
    });

    if (!tariff) {
      throw new TariffNotFoundError(tariffId);
    }

    const updated = await prisma.tariff.update({
      where: { id: tariffId },
      data: {
        ...(input.name && { name: input.name }),
        ...(input.price !== undefined && { price: new Prisma.Decimal(input.price) }),
        ...(input.color && { color: input.color }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
      },
      include: {
        _count: { select: { TariffSeat: true } },
      },
    });

    return {
      id: updated.id,
      sessionId: updated.sessionId,
      name: updated.name,
      price: updated.price.toNumber(),
      color: updated.color,
      description: updated.description,
      isActive: updated.isActive,
      _count: updated._count,
    };
  }

  // ===========================================================================
  // DELETE TARIFF
  // ===========================================================================

  async delete(sessionId: string, tariffId: string) {
    await this.validateSessionForTariff(sessionId);

    const tariff = await prisma.tariff.findFirst({
      where: { id: tariffId, sessionId },
    });

    if (!tariff) {
      throw new TariffNotFoundError(tariffId);
    }

    // Soft delete - set isActive to false
    await prisma.tariff.update({
      where: { id: tariffId },
      data: { isActive: false },
    });

    // Remove all seat assignments for this tariff
    await prisma.tariffSeat.deleteMany({
      where: { tariffId },
    });
  }

  // ===========================================================================
  // GET TARIFFS
  // ===========================================================================

  async findBySessionId(sessionId: string) {
    const tariffs = await prisma.tariff.findMany({
      where: { sessionId, isActive: true },
      include: {
        _count: { select: { TariffSeat: true } },
      },
      orderBy: { price: 'desc' },
    });

    return tariffs.map((tariff) => ({
      id: tariff.id,
      sessionId: tariff.sessionId,
      name: tariff.name,
      price: tariff.price.toNumber(),
      color: tariff.color,
      description: tariff.description,
      isActive: tariff.isActive,
      _count: tariff._count,
    }));
  }

  // ===========================================================================
  // ASSIGN SEATS TO TARIFF
  // ===========================================================================

  async assignSeats(sessionId: string, tariffId: string, input: AssignSeatsToTariffInput) {
    await this.validateSessionForTariff(sessionId);

    const tariff = await prisma.tariff.findFirst({
      where: { id: tariffId, sessionId, isActive: true },
    });

    if (!tariff) {
      throw new TariffNotFoundError(tariffId);
    }

    // Verify all seats belong to this session
    const seats = await prisma.seat.findMany({
      where: {
        id: { in: input.seatIds },
        sessionId,
      },
    });

    if (seats.length !== input.seatIds.length) {
      const foundIds = seats.map((s) => s.id);
      const missingIds = input.seatIds.filter((id) => !foundIds.includes(id));
      throw new Error(`Seats not found in session: ${missingIds.join(', ')}`);
    }

    // Remove existing tariff assignments for these seats
    await prisma.tariffSeat.deleteMany({
      where: {
        seatId: { in: input.seatIds },
      },
    });

    // Create new assignments
    await prisma.tariffSeat.createMany({
      data: input.seatIds.map((seatId) => ({
        tariffId,
        seatId,
      })),
    });

    return { assignedCount: input.seatIds.length };
  }

  // ===========================================================================
  // BULK ASSIGN TARIFFS
  // ===========================================================================

  async bulkAssign(sessionId: string, input: BulkAssignTariffInput) {
    await this.validateSessionForTariff(sessionId);

    // Verify all tariffs belong to this session
    const tariffIds = input.assignments.map((a) => a.tariffId);
    const tariffs = await prisma.tariff.findMany({
      where: {
        id: { in: tariffIds },
        sessionId,
        isActive: true,
      },
    });

    if (tariffs.length !== tariffIds.length) {
      const foundIds = tariffs.map((t) => t.id);
      const missingIds = tariffIds.filter((id) => !foundIds.includes(id));
      throw new TariffNotFoundError(missingIds[0]);
    }

    // Collect all seat IDs
    const allSeatIds = input.assignments.flatMap((a) => a.seatIds);

    // Verify all seats belong to this session
    const seats = await prisma.seat.findMany({
      where: {
        id: { in: allSeatIds },
        sessionId,
      },
    });

    if (seats.length !== allSeatIds.length) {
      throw new Error('Some seats do not belong to this session');
    }

    await prisma.$transaction(async (tx) => {
      // Remove all existing assignments for these seats
      await tx.tariffSeat.deleteMany({
        where: {
          seatId: { in: allSeatIds },
        },
      });

      // Create all new assignments
      const newAssignments: { tariffId: string; seatId: string }[] = [];
      for (const assignment of input.assignments) {
        for (const seatId of assignment.seatIds) {
          newAssignments.push({
            tariffId: assignment.tariffId,
            seatId,
          });
        }
      }

      await tx.tariffSeat.createMany({
        data: newAssignments,
      });
    });

    return { assignedCount: allSeatIds.length };
  }

  // ===========================================================================
  // AUTO-ASSIGN TARIFFS
  // ===========================================================================

  async autoAssign(sessionId: string, input: AutoAssignTariffInput) {
    await this.validateSessionForTariff(sessionId);

    // Verify all tariffs belong to this session
    const tariffs = await prisma.tariff.findMany({
      where: {
        id: { in: input.tariffIds },
        sessionId,
        isActive: true,
      },
      orderBy: { price: 'desc' },
    });

    if (tariffs.length !== input.tariffIds.length) {
      throw new Error('Some tariffs do not belong to this session');
    }

    // Get all seats for the session
    const seats = await prisma.seat.findMany({
      where: { sessionId },
      orderBy: [{ y: 'asc' }, { x: 'asc' }],
    });

    if (seats.length === 0) {
      return { assignedCount: 0 };
    }

    let assignments: { tariffId: string; seatIds: string[] }[] = [];

    switch (input.strategy) {
      case 'equal_sections': {
        // Divide seats equally among tariffs
        const seatsPerTariff = Math.ceil(seats.length / tariffs.length);
        for (let i = 0; i < tariffs.length; i++) {
          const start = i * seatsPerTariff;
          const end = Math.min(start + seatsPerTariff, seats.length);
          assignments.push({
            tariffId: tariffs[i].id,
            seatIds: seats.slice(start, end).map((s) => s.id),
          });
        }
        break;
      }

      case 'by_row': {
        // Group seats by row, assign each row group to a tariff
        const rows = [...new Set(seats.map((s) => s.row))].sort();
        const rowsPerTariff = Math.ceil(rows.length / tariffs.length);

        for (let i = 0; i < tariffs.length; i++) {
          const startRow = i * rowsPerTariff;
          const endRow = Math.min(startRow + rowsPerTariff, rows.length);
          const tariffRows = rows.slice(startRow, endRow);
          const tariffSeats = seats.filter((s) => tariffRows.includes(s.row));

          assignments.push({
            tariffId: tariffs[i].id,
            seatIds: tariffSeats.map((s) => s.id),
          });
        }
        break;
      }

      case 'by_distance_from_stage': {
        // Sort by Y coordinate (assuming stage is at top, y=0)
        const sortedSeats = [...seats].sort((a, b) => a.y - b.y);
        const seatsPerTariff = Math.ceil(sortedSeats.length / tariffs.length);

        for (let i = 0; i < tariffs.length; i++) {
          const start = i * seatsPerTariff;
          const end = Math.min(start + seatsPerTariff, sortedSeats.length);
          assignments.push({
            tariffId: tariffs[i].id,
            seatIds: sortedSeats.slice(start, end).map((s) => s.id),
          });
        }
        break;
      }
    }

    // Apply assignments
    await prisma.$transaction(async (tx) => {
      // Remove all existing assignments
      const allSeatIds = seats.map((s) => s.id);
      await tx.tariffSeat.deleteMany({
        where: { seatId: { in: allSeatIds } },
      });

      // Create new assignments
      const newAssignments: { tariffId: string; seatId: string }[] = [];
      for (const assignment of assignments) {
        for (const seatId of assignment.seatIds) {
          newAssignments.push({ tariffId: assignment.tariffId, seatId });
        }
      }

      await tx.tariffSeat.createMany({ data: newAssignments });
    });

    return { assignedCount: seats.length };
  }

  // ===========================================================================
  // REMOVE TARIFF FROM SEATS
  // ===========================================================================

  async removeFromSeats(sessionId: string, seatIds: string[]) {
    await this.validateSessionForTariff(sessionId);

    await prisma.tariffSeat.deleteMany({
      where: {
        seatId: { in: seatIds },
        seat: { sessionId },
      },
    });

    return { removedCount: seatIds.length };
  }

  // ===========================================================================
  // GET SEATS BY TARIFF
  // ===========================================================================

  async getSeatsByTariff(sessionId: string, tariffId: string) {
    const tariff = await prisma.tariff.findFirst({
      where: { id: tariffId, sessionId },
      include: {
        TariffSeat: {
          include: {
            seat: true,
          },
        },
      },
    });

    if (!tariff) {
      throw new TariffNotFoundError(tariffId);
    }

    return tariff.TariffSeat.map((ts) => ({
      id: ts.seat.id,
      row: ts.seat.row,
      number: ts.seat.number,
      section: ts.seat.section,
      x: ts.seat.x,
      y: ts.seat.y,
      status: ts.seat.status,
    }));
  }

  // ===========================================================================
  // PRICING RULES
  // ===========================================================================

  async createPricingRule(sessionId: string, input: CreatePricingRuleInput) {
    // Note: This would require a PricingRule model in the schema
    // For now, we'll store pricing rules in a separate way or extend the schema
    // This is a placeholder implementation

    const session = await prisma.session.findUnique({ where: { id: sessionId } });
    if (!session) {
      throw new SessionNotFoundError(sessionId);
    }

    // Store pricing rules - would need schema extension
    // For MVP, we can store these in session metadata or a separate table
    console.log('Pricing rule created:', input);

    return {
      id: 'pricing-rule-id',
      ...input,
      sessionId,
    };
  }

  // ===========================================================================
  // CALCULATE PRICE WITH RULES
  // ===========================================================================

  async calculatePrice(
    sessionId: string,
    seatIds: string[],
    promoCode?: string,
    quantity?: number
  ) {
    // Get seats with their tariffs
    const seats = await prisma.seat.findMany({
      where: {
        id: { in: seatIds },
        sessionId,
      },
      include: {
        TariffSeat: {
          include: { tariff: true },
        },
      },
    });

    // Calculate base price
    const basePrice = seats.reduce((sum, seat) => {
      const tariff = seat.TariffSeat[0]?.tariff;
      return sum + (tariff ? tariff.price.toNumber() : 0);
    }, 0);

    let finalPrice = basePrice;
    let appliedDiscounts: { name: string; amount: number }[] = [];

    // Apply group discount (if quantity >= 5)
    if (quantity && quantity >= 5) {
      const groupDiscount = basePrice * 0.1; // 10% off
      finalPrice -= groupDiscount;
      appliedDiscounts.push({ name: 'Group Discount (10%)', amount: groupDiscount });
    }

    // Promo code would be validated here
    if (promoCode) {
      // Placeholder - would validate against stored promo codes
      // const promoDiscount = ...
    }

    return {
      basePrice,
      finalPrice,
      appliedDiscounts,
      seatCount: seats.length,
    };
  }

  // ===========================================================================
  // HELPERS
  // ===========================================================================

  private async validateSessionForTariff(sessionId: string) {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new SessionNotFoundError(sessionId);
    }

    // Only allow tariff modifications in DRAFT status
    if (session.status !== SessionStatus.DRAFT) {
      throw new SessionNotDraftError(session.status);
    }

    return session;
  }
}

export const tariffService = TariffService.getInstance();

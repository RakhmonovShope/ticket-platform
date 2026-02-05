import { Request, Response, NextFunction } from 'express';
import { sessionService } from './session.service.js';
import { tariffService } from './tariff.service.js';
import {
  CreateSessionSchema,
  UpdateSessionSchema,
  SessionQuerySchema,
  DuplicateSessionSchema,
  CreateTariffSchema,
  CreateMultipleTariffsSchema,
  UpdateTariffSchema,
  AssignSeatsToTariffSchema,
  BulkAssignTariffSchema,
  AutoAssignTariffSchema,
} from './session.types.js';
import { ZodError } from 'zod';

// ============================================================================
// SESSION CONTROLLER
// ============================================================================

class SessionController {
  // ===========================================================================
  // SESSION CRUD
  // ===========================================================================

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const input = CreateSessionSchema.parse(req.body);
      const session = await sessionService.create(input);
      res.status(201).json(session);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          message: 'Validation failed',
          errors: error.errors,
        });
      }
      next(error);
    }
  }

  async findAll(req: Request, res: Response, next: NextFunction) {
    try {
      const query = SessionQuerySchema.parse(req.query);
      const result = await sessionService.findAll(query);
      res.json(result);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          message: 'Validation failed',
          errors: error.errors,
        });
      }
      next(error);
    }
  }

  async findById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const session = await sessionService.findById(id);
      res.json(session);
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const input = UpdateSessionSchema.parse(req.body);
      const session = await sessionService.update(id, input);
      res.json(session);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          message: 'Validation failed',
          errors: error.errors,
        });
      }
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      await sessionService.delete(id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }

  // ===========================================================================
  // SESSION LIFECYCLE
  // ===========================================================================

  async publish(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const session = await sessionService.publish(id);

      // Emit WebSocket event for session publish
      // This would be integrated with the socket server
      const io = req.app.get('io');
      if (io) {
        io.emit('session_published', {
          sessionId: session.id,
          name: session.name,
          status: session.status,
        });
      }

      res.json(session);
    } catch (error) {
      next(error);
    }
  }

  async cancel(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { reason } = req.body || {};
      const session = await sessionService.cancel(id, reason);

      // Emit WebSocket event for session cancellation
      const io = req.app.get('io');
      if (io) {
        io.emit('session_cancelled', {
          sessionId: session.id,
          name: session.name,
          reason,
        });
      }

      res.json(session);
    } catch (error) {
      next(error);
    }
  }

  async duplicate(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const input = DuplicateSessionSchema.parse(req.body);
      const session = await sessionService.duplicate(id, input);
      res.status(201).json(session);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          message: 'Validation failed',
          errors: error.errors,
        });
      }
      next(error);
    }
  }

  // ===========================================================================
  // TARIFF MANAGEMENT
  // ===========================================================================

  async createTariff(req: Request, res: Response, next: NextFunction) {
    try {
      const { id: sessionId } = req.params;
      const input = CreateTariffSchema.parse(req.body);
      const tariff = await tariffService.create(sessionId, input);
      res.status(201).json(tariff);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          message: 'Validation failed',
          errors: error.errors,
        });
      }
      next(error);
    }
  }

  async createMultipleTariffs(req: Request, res: Response, next: NextFunction) {
    try {
      const { id: sessionId } = req.params;
      const input = CreateMultipleTariffsSchema.parse(req.body);
      const tariffs = await tariffService.createMultiple(sessionId, input);
      res.status(201).json(tariffs);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          message: 'Validation failed',
          errors: error.errors,
        });
      }
      next(error);
    }
  }

  async getTariffs(req: Request, res: Response, next: NextFunction) {
    try {
      const { id: sessionId } = req.params;
      const tariffs = await tariffService.findBySessionId(sessionId);
      res.json(tariffs);
    } catch (error) {
      next(error);
    }
  }

  async updateTariff(req: Request, res: Response, next: NextFunction) {
    try {
      const { id: sessionId, tariffId } = req.params;
      const input = UpdateTariffSchema.parse(req.body);
      const tariff = await tariffService.update(sessionId, tariffId, input);
      res.json(tariff);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          message: 'Validation failed',
          errors: error.errors,
        });
      }
      next(error);
    }
  }

  async deleteTariff(req: Request, res: Response, next: NextFunction) {
    try {
      const { id: sessionId, tariffId } = req.params;
      await tariffService.delete(sessionId, tariffId);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }

  // ===========================================================================
  // TARIFF SEAT ASSIGNMENT
  // ===========================================================================

  async assignSeatsToTariff(req: Request, res: Response, next: NextFunction) {
    try {
      const { id: sessionId, tariffId } = req.params;
      const input = AssignSeatsToTariffSchema.parse(req.body);
      const result = await tariffService.assignSeats(sessionId, tariffId, input);
      res.json(result);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          message: 'Validation failed',
          errors: error.errors,
        });
      }
      next(error);
    }
  }

  async bulkAssignTariffs(req: Request, res: Response, next: NextFunction) {
    try {
      const { id: sessionId } = req.params;
      const input = BulkAssignTariffSchema.parse(req.body);
      const result = await tariffService.bulkAssign(sessionId, input);
      res.json(result);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          message: 'Validation failed',
          errors: error.errors,
        });
      }
      next(error);
    }
  }

  async autoAssignTariffs(req: Request, res: Response, next: NextFunction) {
    try {
      const { id: sessionId } = req.params;
      const input = AutoAssignTariffSchema.parse(req.body);
      const result = await tariffService.autoAssign(sessionId, input);
      res.json(result);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          message: 'Validation failed',
          errors: error.errors,
        });
      }
      next(error);
    }
  }

  async getSeatsByTariff(req: Request, res: Response, next: NextFunction) {
    try {
      const { id: sessionId, tariffId } = req.params;
      const seats = await tariffService.getSeatsByTariff(sessionId, tariffId);
      res.json(seats);
    } catch (error) {
      next(error);
    }
  }

  async removeSeatsFromTariff(req: Request, res: Response, next: NextFunction) {
    try {
      const { id: sessionId } = req.params;
      const { seatIds } = req.body;

      if (!Array.isArray(seatIds) || seatIds.length === 0) {
        return res.status(400).json({ message: 'seatIds must be a non-empty array' });
      }

      const result = await tariffService.removeFromSeats(sessionId, seatIds);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  // ===========================================================================
  // PRICING
  // ===========================================================================

  async calculatePrice(req: Request, res: Response, next: NextFunction) {
    try {
      const { id: sessionId } = req.params;
      const { seatIds, promoCode, quantity } = req.body;

      if (!Array.isArray(seatIds) || seatIds.length === 0) {
        return res.status(400).json({ message: 'seatIds must be a non-empty array' });
      }

      const result = await tariffService.calculatePrice(sessionId, seatIds, promoCode, quantity);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
}

export const sessionController = new SessionController();

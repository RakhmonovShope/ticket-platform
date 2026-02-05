import type { Request, Response, NextFunction } from 'express';
import { venueService } from './venue.service.js';
import {
  CreateVenueSchema,
  UpdateVenueSchema,
  VenueQuerySchema,
  VenueIdParamSchema,
  UpdateVenueSchemaBody,
  VenueSchemaDefinition,
} from './venue.types.js';

export class VenueController {
  /**
   * GET /api/venues
   * List all active venues with session count
   * Access: Public
   */
  async findAll(req: Request, res: Response, next: NextFunction) {
    try {
      const query = VenueQuerySchema.parse(req.query);
      const result = await venueService.findAll(query);

      res.json({
        success: true,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/venues/:id
   * Get single venue with recent sessions
   * Access: Public
   */
  async findById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = VenueIdParamSchema.parse(req.params);
      const venue = await venueService.findById(id);

      res.json({
        success: true,
        data: venue,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/venues
   * Create venue with schema validation
   * Access: ADMIN, MANAGER only
   */
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const data = CreateVenueSchema.parse(req.body);
      const venue = await venueService.create(data);

      res.status(201).json({
        success: true,
        data: venue,
        message: 'Venue created successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/venues/:id
   * Update venue basic info
   * Access: ADMIN, MANAGER only
   */
  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = VenueIdParamSchema.parse(req.params);
      const data = UpdateVenueSchema.parse(req.body);
      const venue = await venueService.update(id, data);

      res.json({
        success: true,
        data: venue,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/venues/:id/schema
   * Full schema replacement with validation
   * Access: ADMIN, MANAGER only
   */
  async updateSchema(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = VenueIdParamSchema.parse(req.params);
      const { schema } = UpdateVenueSchemaBody.parse(req.body);
      const venue = await venueService.updateSchema(id, schema);

      res.json({
        success: true,
        data: venue,
        message: 'Venue schema updated successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/venues/validate-schema
   * Validate a schema without creating/updating
   * Access: ADMIN, MANAGER only
   */
  async validateSchema(req: Request, res: Response, next: NextFunction) {
    try {
      // First validate with Zod
      const schema = VenueSchemaDefinition.parse(req.body);
      
      // Then run detailed validation
      const result = venueService.validateSchema(schema);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/venues/:id
   * Soft delete (deactivate) a venue
   * Access: ADMIN only
   */
  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = VenueIdParamSchema.parse(req.params);
      const result = await venueService.softDelete(id);

      res.json({
        success: true,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/venues/:id/permanent
   * Hard delete a venue (no session history)
   * Access: ADMIN only
   */
  async hardDelete(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = VenueIdParamSchema.parse(req.params);
      const result = await venueService.hardDelete(id);

      res.json({
        success: true,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/venues/:id/stats
   * Get venue statistics
   * Access: ADMIN, MANAGER only
   */
  async getStats(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = VenueIdParamSchema.parse(req.params);
      const stats = await venueService.getStats(id);

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      next(error);
    }
  }
}

// Export singleton instance
export const venueController = new VenueController();

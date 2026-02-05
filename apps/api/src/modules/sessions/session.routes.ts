import { Router } from 'express';
import { sessionController } from './session.controller.js';

const router = Router();

// ============================================================================
// SESSION ROUTES
// ============================================================================

/**
 * Session CRUD
 */
// POST /api/sessions - Create a new session
router.post('/', sessionController.create.bind(sessionController));

// GET /api/sessions - Get all sessions with filtering and pagination
router.get('/', sessionController.findAll.bind(sessionController));

// GET /api/sessions/:id - Get session details by ID
router.get('/:id', sessionController.findById.bind(sessionController));

// PUT /api/sessions/:id - Update session
router.put('/:id', sessionController.update.bind(sessionController));

// DELETE /api/sessions/:id - Delete session (only DRAFT sessions)
router.delete('/:id', sessionController.delete.bind(sessionController));

/**
 * Session Lifecycle
 */
// POST /api/sessions/:id/publish - Publish session (DRAFT -> ACTIVE)
router.post('/:id/publish', sessionController.publish.bind(sessionController));

// POST /api/sessions/:id/cancel - Cancel session with optional reason
router.post('/:id/cancel', sessionController.cancel.bind(sessionController));

// POST /api/sessions/:id/duplicate - Duplicate session with new times
router.post('/:id/duplicate', sessionController.duplicate.bind(sessionController));

/**
 * Tariff Management
 */
// POST /api/sessions/:id/tariffs - Create a single tariff
router.post('/:id/tariffs', sessionController.createTariff.bind(sessionController));

// POST /api/sessions/:id/tariffs/bulk - Create multiple tariffs at once
router.post('/:id/tariffs/bulk', sessionController.createMultipleTariffs.bind(sessionController));

// GET /api/sessions/:id/tariffs - Get all tariffs for a session
router.get('/:id/tariffs', sessionController.getTariffs.bind(sessionController));

// PUT /api/sessions/:id/tariffs/:tariffId - Update a tariff
router.put('/:id/tariffs/:tariffId', sessionController.updateTariff.bind(sessionController));

// DELETE /api/sessions/:id/tariffs/:tariffId - Delete a tariff
router.delete('/:id/tariffs/:tariffId', sessionController.deleteTariff.bind(sessionController));

/**
 * Tariff Seat Assignment
 */
// PUT /api/sessions/:id/tariffs/:tariffId/seats - Assign specific seats to a tariff
router.put('/:id/tariffs/:tariffId/seats', sessionController.assignSeatsToTariff.bind(sessionController));

// GET /api/sessions/:id/tariffs/:tariffId/seats - Get all seats for a tariff
router.get('/:id/tariffs/:tariffId/seats', sessionController.getSeatsByTariff.bind(sessionController));

// POST /api/sessions/:id/tariffs/bulk-assign - Bulk assign seats to tariffs by section/row
router.post('/:id/tariffs/bulk-assign', sessionController.bulkAssignTariffs.bind(sessionController));

// POST /api/sessions/:id/tariffs/auto-assign - Auto-assign seats to tariffs using strategy
router.post('/:id/tariffs/auto-assign', sessionController.autoAssignTariffs.bind(sessionController));

// DELETE /api/sessions/:id/seats/tariffs - Remove tariff assignment from seats
router.delete('/:id/seats/tariffs', sessionController.removeSeatsFromTariff.bind(sessionController));

/**
 * Pricing
 */
// POST /api/sessions/:id/calculate-price - Calculate price for selected seats
router.post('/:id/calculate-price', sessionController.calculatePrice.bind(sessionController));

export { router as sessionRoutes };

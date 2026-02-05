import { Router } from 'express';
import { venueController } from './venue.controller.js';
import { authenticate, requireAdmin, requireAdminOrManager } from '../../middleware/auth.js';

const router = Router();

// ============================================================================
// PUBLIC ROUTES (No authentication required)
// ============================================================================

/**
 * @route   GET /api/venues
 * @desc    List all active venues with session count
 * @access  Public
 * @query   page, limit, search, isActive, sortBy, sortOrder
 */
router.get('/', (req, res, next) => venueController.findAll(req, res, next));

/**
 * @route   GET /api/venues/:id
 * @desc    Get single venue with recent sessions
 * @access  Public
 * @params  id - Venue ID
 */
router.get('/:id', (req, res, next) => venueController.findById(req, res, next));

// ============================================================================
// PROTECTED ROUTES - ADMIN/MANAGER
// ============================================================================

/**
 * @route   POST /api/venues
 * @desc    Create venue with schema validation
 * @access  ADMIN, MANAGER only
 * @body    { name, address, description?, schema }
 * @validation
 *   - Schema must have at least 1 seat
 *   - Seat coordinates must be within canvas bounds
 *   - No overlapping seats allowed
 */
router.post(
  '/',
  authenticate,
  requireAdminOrManager,
  (req, res, next) => venueController.create(req, res, next)
);

/**
 * @route   PATCH /api/venues/:id
 * @desc    Update venue basic info (not schema)
 * @access  ADMIN, MANAGER only
 * @params  id - Venue ID
 * @body    { name?, address?, description?, isActive? }
 */
router.patch(
  '/:id',
  authenticate,
  requireAdminOrManager,
  (req, res, next) => venueController.update(req, res, next)
);

/**
 * @route   PUT /api/venues/:id/schema
 * @desc    Full schema replacement with validation
 * @access  ADMIN, MANAGER only
 * @params  id - Venue ID
 * @body    { schema: VenueSchema }
 * @validation
 *   - Schema must have at least 1 seat
 *   - Seat coordinates must be within canvas bounds
 *   - No overlapping seats allowed
 *   - All section/seat references must be valid
 */
router.put(
  '/:id/schema',
  authenticate,
  requireAdminOrManager,
  (req, res, next) => venueController.updateSchema(req, res, next)
);

/**
 * @route   POST /api/venues/validate-schema
 * @desc    Validate a schema without creating/updating venue
 * @access  ADMIN, MANAGER only
 * @body    VenueSchema object
 * @returns { valid: boolean, errors: [], warnings: [], stats: {} }
 */
router.post(
  '/validate-schema',
  authenticate,
  requireAdminOrManager,
  (req, res, next) => venueController.validateSchema(req, res, next)
);

/**
 * @route   GET /api/venues/:id/stats
 * @desc    Get venue statistics
 * @access  ADMIN, MANAGER only
 * @params  id - Venue ID
 */
router.get(
  '/:id/stats',
  authenticate,
  requireAdminOrManager,
  (req, res, next) => venueController.getStats(req, res, next)
);

// ============================================================================
// PROTECTED ROUTES - ADMIN ONLY
// ============================================================================

/**
 * @route   DELETE /api/venues/:id
 * @desc    Soft delete (deactivate) a venue
 * @access  ADMIN only
 * @params  id - Venue ID
 * @note    Cannot delete venues with active sessions
 */
router.delete(
  '/:id',
  authenticate,
  requireAdmin,
  (req, res, next) => venueController.delete(req, res, next)
);

/**
 * @route   DELETE /api/venues/:id/permanent
 * @desc    Permanently delete a venue
 * @access  ADMIN only
 * @params  id - Venue ID
 * @note    Only possible if venue has no session history
 */
router.delete(
  '/:id/permanent',
  authenticate,
  requireAdmin,
  (req, res, next) => venueController.hardDelete(req, res, next)
);

export { router as venueRoutes };

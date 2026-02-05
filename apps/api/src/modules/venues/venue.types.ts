import { z } from 'zod';

// ============================================================================
// VENUE SCHEMA TYPES (JSON structure for seat layout)
// ============================================================================

export const StageDefinitionSchema = z.object({
  x: z.number().min(0, 'Stage x must be non-negative'),
  y: z.number().min(0, 'Stage y must be non-negative'),
  width: z.number().positive('Stage width must be positive'),
  height: z.number().positive('Stage height must be positive'),
  label: z.string().optional(),
});

export const SeatDefinitionSchema = z.object({
  id: z.string().min(1, 'Seat id is required'),
  row: z.string().min(1, 'Seat row is required'),
  number: z.string().min(1, 'Seat number is required'),
  section: z.string().min(1, 'Seat section is required'),
  x: z.number().min(0, 'Seat x must be non-negative'),
  y: z.number().min(0, 'Seat y must be non-negative'),
  width: z.number().positive('Seat width must be positive').default(30),
  height: z.number().positive('Seat height must be positive').default(30),
  shape: z.enum(['RECTANGLE', 'CIRCLE', 'POLYGON']).default('RECTANGLE'),
  rotation: z.number().min(0).max(360).default(0),
});

export const SectionDefinitionSchema = z.object({
  id: z.string().min(1, 'Section id is required'),
  name: z.string().min(1, 'Section name is required'),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color format'),
  seatIds: z.array(z.string()),
});

export const AisleDefinitionSchema = z.object({
  id: z.string().min(1, 'Aisle id is required'),
  points: z
    .array(
      z.object({
        x: z.number().min(0),
        y: z.number().min(0),
      })
    )
    .min(2, 'Aisle must have at least 2 points'),
});

// Base schema without refinements (for internal use)
const VenueSchemaBase = z.object({
  width: z.number().positive('Canvas width must be positive').default(800),
  height: z.number().positive('Canvas height must be positive').default(600),
  stage: StageDefinitionSchema.optional(),
  sections: z.array(SectionDefinitionSchema).min(1, 'At least 1 section is required'),
  seats: z.array(SeatDefinitionSchema).min(1, 'At least 1 seat is required'),
  aisles: z.array(AisleDefinitionSchema).optional().default([]),
});

// Full schema with validation refinements
export const VenueSchemaDefinition = VenueSchemaBase.superRefine((data, ctx) => {
  const { width: canvasWidth, height: canvasHeight, sections, seats, stage } = data;

  // Collect all seat IDs for reference validation
  const seatIdSet = new Set<string>();
  const sectionIdSet = new Set<string>();

  // Check for duplicate section IDs
  for (const section of sections) {
    if (sectionIdSet.has(section.id)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Duplicate section ID: ${section.id}`,
        path: ['sections'],
      });
    }
    sectionIdSet.add(section.id);
  }

  // Validate seats
  for (let i = 0; i < seats.length; i++) {
    const seat = seats[i];

    // Check for duplicate seat IDs
    if (seatIdSet.has(seat.id)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Duplicate seat ID: ${seat.id}`,
        path: ['seats', i, 'id'],
      });
    }
    seatIdSet.add(seat.id);

    // Validate seat is within canvas bounds
    if (seat.x < 0 || seat.x + seat.width > canvasWidth) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Seat "${seat.row}-${seat.number}" x coordinate (${seat.x}) is outside canvas bounds (0-${canvasWidth - seat.width})`,
        path: ['seats', i, 'x'],
      });
    }

    if (seat.y < 0 || seat.y + seat.height > canvasHeight) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Seat "${seat.row}-${seat.number}" y coordinate (${seat.y}) is outside canvas bounds (0-${canvasHeight - seat.height})`,
        path: ['seats', i, 'y'],
      });
    }

    // Validate seat references valid section
    if (!sectionIdSet.has(seat.section)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Seat "${seat.row}-${seat.number}" references non-existent section: ${seat.section}`,
        path: ['seats', i, 'section'],
      });
    }
  }

  // Validate section seatIds reference existing seats
  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    for (const seatId of section.seatIds) {
      if (!seatIdSet.has(seatId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Section "${section.name}" references non-existent seat: ${seatId}`,
          path: ['sections', i, 'seatIds'],
        });
      }
    }
  }

  // Validate stage is within canvas bounds (if present)
  if (stage) {
    if (stage.x < 0 || stage.x + stage.width > canvasWidth) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Stage x coordinate is outside canvas bounds`,
        path: ['stage', 'x'],
      });
    }
    if (stage.y < 0 || stage.y + stage.height > canvasHeight) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Stage y coordinate is outside canvas bounds`,
        path: ['stage', 'y'],
      });
    }
  }

  // Check for overlapping seats (O(n²) but necessary for validation)
  for (let i = 0; i < seats.length; i++) {
    for (let j = i + 1; j < seats.length; j++) {
      const seat1 = seats[i];
      const seat2 = seats[j];

      if (seatsOverlap(seat1, seat2)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Seats "${seat1.row}-${seat1.number}" and "${seat2.row}-${seat2.number}" overlap`,
          path: ['seats'],
        });
      }
    }
  }
});

/**
 * Check if two seats overlap (AABB collision detection)
 */
function seatsOverlap(
  seat1: { x: number; y: number; width: number; height: number },
  seat2: { x: number; y: number; width: number; height: number }
): boolean {
  return !(
    seat1.x + seat1.width <= seat2.x ||  // seat1 is left of seat2
    seat2.x + seat2.width <= seat1.x ||  // seat2 is left of seat1
    seat1.y + seat1.height <= seat2.y || // seat1 is above seat2
    seat2.y + seat2.height <= seat1.y    // seat2 is above seat1
  );
}

// ============================================================================
// API REQUEST SCHEMAS
// ============================================================================

export const CreateVenueSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255, 'Name too long'),
  address: z.string().min(1, 'Address is required').max(500, 'Address too long'),
  description: z.string().max(2000, 'Description too long').optional(),
  schema: VenueSchemaDefinition,
  isActive: z.boolean().optional().default(true),
});

export const UpdateVenueSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  address: z.string().min(1).max(500).optional(),
  description: z.string().max(2000).nullable().optional(),
  isActive: z.boolean().optional(),
});

export const UpdateVenueSchemaBody = z.object({
  schema: VenueSchemaDefinition,
});

export const VenueQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  search: z.string().optional(),
  isActive: z
    .enum(['true', 'false'])
    .optional()
    .transform((val) => (val === undefined ? undefined : val === 'true')),
  sortBy: z.enum(['name', 'capacity', 'createdAt']).optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export const VenueIdParamSchema = z.object({
  id: z.string().min(1, 'Venue ID is required'),
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type StageDefinition = z.infer<typeof StageDefinitionSchema>;
export type SeatDefinition = z.infer<typeof SeatDefinitionSchema>;
export type SectionDefinition = z.infer<typeof SectionDefinitionSchema>;
export type AisleDefinition = z.infer<typeof AisleDefinitionSchema>;
export type VenueSchemaType = z.infer<typeof VenueSchemaDefinition>;

export type CreateVenueInput = z.infer<typeof CreateVenueSchema>;
export type UpdateVenueInput = z.infer<typeof UpdateVenueSchema>;
export type UpdateVenueSchemaInput = z.infer<typeof UpdateVenueSchemaBody>;
export type VenueQuery = z.infer<typeof VenueQuerySchema>;
export type VenueIdParam = z.infer<typeof VenueIdParamSchema>;

// ============================================================================
// RESPONSE TYPES
// ============================================================================

export interface VenueWithSessionCount {
  id: string;
  name: string;
  address: string;
  description: string | null;
  schema: VenueSchemaType;
  capacity: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  _count: {
    sessions: number;
  };
}

export interface VenueWithSessions {
  id: string;
  name: string;
  address: string;
  description: string | null;
  schema: VenueSchemaType;
  capacity: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  sessions: Array<{
    id: string;
    name: string;
    startTime: Date;
    endTime: Date;
    status: string;
  }>;
}

// ============================================================================
// VALIDATION RESULT TYPES
// ============================================================================

export interface SchemaValidationResult {
  valid: boolean;
  errors: SchemaValidationError[];
  warnings: string[];
  stats: {
    totalSeats: number;
    totalSections: number;
    canvasSize: { width: number; height: number };
  };
}

export interface SchemaValidationError {
  code: string;
  message: string;
  path?: string;
  details?: Record<string, unknown>;
}

// ============================================================================
// HELPER FUNCTIONS EXPORTED FOR USE ELSEWHERE
// ============================================================================

export { seatsOverlap };

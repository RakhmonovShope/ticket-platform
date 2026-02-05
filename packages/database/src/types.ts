/**
 * TypeScript types for JSON fields in the Prisma schema
 * These types provide better type safety when working with JSON columns
 */

// ============================================================================
// VENUE SCHEMA TYPES (Venue.schema)
// ============================================================================

export interface VenueSeatDefinition {
  id: string;
  row: string;           // "A", "B", "1", "2"
  number: string;        // "1", "2", "15"
  section: string;       // Reference to section id
  x: number;
  y: number;
  width: number;         // default 30
  height: number;        // default 30
  shape: 'RECTANGLE' | 'CIRCLE' | 'POLYGON';
  rotation: number;      // degrees, default 0
}

export interface VenueSectionDefinition {
  id: string;
  name: string;
  color: string;         // Hex color
  seatIds: string[];     // References to seat ids
}

export interface VenueStageDefinition {
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
}

export interface VenueAisleDefinition {
  id: string;
  points: Array<{ x: number; y: number }>;
}

/**
 * JSON schema stored in Venue.schema
 * This template is copied to create seats when a session is created
 */
export interface VenueSchema {
  width: number;         // Canvas width (default 800)
  height: number;        // Canvas height (default 600)
  stage?: VenueStageDefinition;
  sections: VenueSectionDefinition[];
  seats: VenueSeatDefinition[];
  aisles?: VenueAisleDefinition[];
}

// ============================================================================
// HELPER TYPE UTILITIES
// ============================================================================

/**
 * Use this to cast JSON fields to proper types
 * @example
 * const venue = await prisma.venue.findUnique({ where: { id } });
 * const schema = venue?.schema as JsonField<VenueSchema>;
 */
export type JsonField<T> = T | null;

/**
 * Type guard for checking if a value matches VenueSchema structure
 */
export function isVenueSchema(value: unknown): value is VenueSchema {
  if (!value || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  return (
    'sections' in obj &&
    Array.isArray(obj.sections) &&
    'seats' in obj &&
    Array.isArray(obj.seats)
  );
}

/**
 * Helper to create seats from venue schema for a session
 * Returns array of seat data ready for prisma.seat.createMany
 */
export function createSeatsFromVenueSchema(
  sessionId: string,
  venueSchema: VenueSchema
): Array<{
  sessionId: string;
  row: string;
  number: string;
  section: string;
  x: number;
  y: number;
  width: number;
  height: number;
  shape: 'RECTANGLE' | 'CIRCLE' | 'POLYGON';
  rotation: number;
}> {
  // Create a map of sectionId -> sectionName
  const sectionNameMap = new Map<string, string>();
  for (const section of venueSchema.sections) {
    sectionNameMap.set(section.id, section.name);
  }

  return venueSchema.seats.map((seat) => ({
    sessionId,
    row: seat.row,
    number: seat.number,
    section: sectionNameMap.get(seat.section) || seat.section,
    x: seat.x,
    y: seat.y,
    width: seat.width,
    height: seat.height,
    shape: seat.shape,
    rotation: seat.rotation,
  }));
}

/**
 * Calculate booking expiration time (createdAt + 10 minutes)
 */
export function calculateBookingExpiration(createdAt: Date = new Date()): Date {
  const expiresAt = new Date(createdAt);
  expiresAt.setMinutes(expiresAt.getMinutes() + 10);
  return expiresAt;
}

/**
 * Check if a booking has expired
 */
export function isBookingExpired(expiresAt: Date): boolean {
  return new Date() > expiresAt;
}

/**
 * Validate venue schema consistency
 * - All section.seatIds must reference existing seats
 * - All seat.section must reference existing sections
 */
export function validateVenueSchema(schema: VenueSchema): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  const seatIds = new Set(schema.seats.map((s) => s.id));
  const sectionIds = new Set(schema.sections.map((s) => s.id));

  // Check section seatIds reference existing seats
  for (const section of schema.sections) {
    for (const seatId of section.seatIds) {
      if (!seatIds.has(seatId)) {
        errors.push(`Section "${section.name}" references non-existent seat: ${seatId}`);
      }
    }
  }

  // Check seats reference existing sections
  for (const seat of schema.seats) {
    if (!sectionIds.has(seat.section)) {
      errors.push(`Seat "${seat.row}-${seat.number}" references non-existent section: ${seat.section}`);
    }
  }

  // Check for duplicate seat IDs
  if (seatIds.size !== schema.seats.length) {
    errors.push('Duplicate seat IDs found in schema');
  }

  // Check for duplicate section IDs
  if (sectionIds.size !== schema.sections.length) {
    errors.push('Duplicate section IDs found in schema');
  }

  return { valid: errors.length === 0, errors };
}

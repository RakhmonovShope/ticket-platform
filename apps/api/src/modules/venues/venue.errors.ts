import { AppError } from '../../middleware/error-handler.js';

/**
 * Custom error classes for Venue module
 */

export class VenueNotFoundError extends AppError {
  constructor(venueId: string) {
    super(404, `Venue with ID "${venueId}" not found`, 'VENUE_NOT_FOUND');
    this.name = 'VenueNotFoundError';
  }
}

export class VenueHasActiveSessionsError extends AppError {
  constructor(venueId: string, sessionCount: number) {
    super(
      409,
      `Cannot delete venue "${venueId}": has ${sessionCount} active session(s). Cancel or complete all sessions first.`,
      'VENUE_HAS_ACTIVE_SESSIONS'
    );
    this.name = 'VenueHasActiveSessionsError';
  }
}

export class VenueHasSessionHistoryError extends AppError {
  constructor(venueId: string) {
    super(
      409,
      `Cannot permanently delete venue "${venueId}": has session history. Use soft delete instead.`,
      'VENUE_HAS_SESSION_HISTORY'
    );
    this.name = 'VenueHasSessionHistoryError';
  }
}

export class InvalidVenueSchemaError extends AppError {
  public readonly validationErrors: SchemaError[];

  constructor(errors: SchemaError[]) {
    const message = errors.length === 1
      ? errors[0].message
      : `Schema validation failed with ${errors.length} errors`;
    
    super(400, message, 'INVALID_VENUE_SCHEMA');
    this.name = 'InvalidVenueSchemaError';
    this.validationErrors = errors;
  }

  toJSON() {
    return {
      error: this.message,
      code: this.code,
      validationErrors: this.validationErrors,
    };
  }
}

export interface SchemaError {
  code: string;
  message: string;
  path?: string;
  seat1?: string;
  seat2?: string;
}

// Error codes for schema validation
export const SchemaErrorCodes = {
  NO_SEATS: 'NO_SEATS',
  NO_SECTIONS: 'NO_SECTIONS',
  DUPLICATE_SEAT_ID: 'DUPLICATE_SEAT_ID',
  DUPLICATE_SECTION_ID: 'DUPLICATE_SECTION_ID',
  SEAT_OUT_OF_BOUNDS: 'SEAT_OUT_OF_BOUNDS',
  SEATS_OVERLAP: 'SEATS_OVERLAP',
  INVALID_SECTION_REFERENCE: 'INVALID_SECTION_REFERENCE',
  INVALID_SEAT_REFERENCE: 'INVALID_SEAT_REFERENCE',
  STAGE_OUT_OF_BOUNDS: 'STAGE_OUT_OF_BOUNDS',
  INVALID_CANVAS_SIZE: 'INVALID_CANVAS_SIZE',
} as const;

export type SchemaErrorCode = typeof SchemaErrorCodes[keyof typeof SchemaErrorCodes];

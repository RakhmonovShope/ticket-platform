import { AppError } from '../../middleware/error-handler.js';

// ============================================================================
// ERROR CODES
// ============================================================================

export const SESSION_ERROR_CODES = {
  SESSION_NOT_FOUND: 'SESSION_NOT_FOUND',
  VENUE_NOT_FOUND: 'VENUE_NOT_FOUND',
  TARIFF_NOT_FOUND: 'TARIFF_NOT_FOUND',
  SEAT_NOT_FOUND: 'SEAT_NOT_FOUND',
  INVALID_STATUS_TRANSITION: 'INVALID_STATUS_TRANSITION',
  SESSION_OVERLAP: 'SESSION_OVERLAP',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  SEATS_WITHOUT_TARIFF: 'SEATS_WITHOUT_TARIFF',
  SESSION_NOT_DRAFT: 'SESSION_NOT_DRAFT',
  SESSION_NOT_ACTIVE: 'SESSION_NOT_ACTIVE',
  CANNOT_CANCEL_SESSION: 'CANNOT_CANCEL_SESSION',
  PRICING_RULE_NOT_FOUND: 'PRICING_RULE_NOT_FOUND',
  INVALID_PROMO_CODE: 'INVALID_PROMO_CODE',
} as const;

export type SessionErrorCode = (typeof SESSION_ERROR_CODES)[keyof typeof SESSION_ERROR_CODES];

// ============================================================================
// BASE ERROR CLASS
// ============================================================================

export class SessionError extends AppError {
  public readonly code: SessionErrorCode;

  constructor(code: SessionErrorCode, message: string, statusCode: number = 400) {
    super(statusCode, message);
    this.code = code;
    this.name = 'SessionError';
  }
}

// ============================================================================
// SPECIFIC ERROR CLASSES
// ============================================================================

export class SessionNotFoundError extends SessionError {
  public readonly sessionId: string;

  constructor(sessionId: string) {
    super(SESSION_ERROR_CODES.SESSION_NOT_FOUND, `Session ${sessionId} not found`, 404);
    this.sessionId = sessionId;
    this.name = 'SessionNotFoundError';
  }
}

export class VenueNotFoundError extends SessionError {
  public readonly venueId: string;

  constructor(venueId: string) {
    super(SESSION_ERROR_CODES.VENUE_NOT_FOUND, `Venue ${venueId} not found`, 404);
    this.venueId = venueId;
    this.name = 'VenueNotFoundError';
  }
}

export class TariffNotFoundError extends SessionError {
  public readonly tariffId: string;

  constructor(tariffId: string) {
    super(SESSION_ERROR_CODES.TARIFF_NOT_FOUND, `Tariff ${tariffId} not found`, 404);
    this.tariffId = tariffId;
    this.name = 'TariffNotFoundError';
  }
}

export class InvalidStatusTransitionError extends SessionError {
  public readonly currentStatus: string;
  public readonly targetStatus: string;

  constructor(currentStatus: string, targetStatus: string) {
    super(
      SESSION_ERROR_CODES.INVALID_STATUS_TRANSITION,
      `Cannot transition from ${currentStatus} to ${targetStatus}`,
      400
    );
    this.currentStatus = currentStatus;
    this.targetStatus = targetStatus;
    this.name = 'InvalidStatusTransitionError';
  }
}

export class SessionOverlapError extends SessionError {
  public readonly venueId: string;
  public readonly conflictingSessionId: string;

  constructor(venueId: string, conflictingSessionId: string) {
    super(
      SESSION_ERROR_CODES.SESSION_OVERLAP,
      `Session overlaps with existing session ${conflictingSessionId} in venue ${venueId}`,
      409
    );
    this.venueId = venueId;
    this.conflictingSessionId = conflictingSessionId;
    this.name = 'SessionOverlapError';
  }
}

export class SeatsWithoutTariffError extends SessionError {
  public readonly seatCount: number;

  constructor(seatCount: number) {
    super(
      SESSION_ERROR_CODES.SEATS_WITHOUT_TARIFF,
      `${seatCount} seats do not have a tariff assigned. All seats must have tariffs before publishing.`,
      400
    );
    this.seatCount = seatCount;
    this.name = 'SeatsWithoutTariffError';
  }
}

export class SessionNotDraftError extends SessionError {
  public readonly currentStatus: string;

  constructor(currentStatus: string) {
    super(
      SESSION_ERROR_CODES.SESSION_NOT_DRAFT,
      `Session must be in DRAFT status to perform this action. Current status: ${currentStatus}`,
      400
    );
    this.currentStatus = currentStatus;
    this.name = 'SessionNotDraftError';
  }
}

export class SessionNotActiveError extends SessionError {
  public readonly currentStatus: string;

  constructor(currentStatus: string) {
    super(
      SESSION_ERROR_CODES.SESSION_NOT_ACTIVE,
      `Session must be in ACTIVE status to perform this action. Current status: ${currentStatus}`,
      400
    );
    this.currentStatus = currentStatus;
    this.name = 'SessionNotActiveError';
  }
}

export class CannotCancelSessionError extends SessionError {
  public readonly reason: string;

  constructor(reason: string) {
    super(SESSION_ERROR_CODES.CANNOT_CANCEL_SESSION, `Cannot cancel session: ${reason}`, 400);
    this.reason = reason;
    this.name = 'CannotCancelSessionError';
  }
}

export class InvalidPromoCodeError extends SessionError {
  public readonly promoCode: string;

  constructor(promoCode: string, reason: string) {
    super(SESSION_ERROR_CODES.INVALID_PROMO_CODE, `Promo code '${promoCode}' is invalid: ${reason}`, 400);
    this.promoCode = promoCode;
    this.name = 'InvalidPromoCodeError';
  }
}

export class ValidationFailedError extends SessionError {
  public readonly errors: string[];

  constructor(errors: string[]) {
    super(
      SESSION_ERROR_CODES.VALIDATION_FAILED,
      `Validation failed: ${errors.join(', ')}`,
      400
    );
    this.errors = errors;
    this.name = 'ValidationFailedError';
  }
}

import { AppError } from '../../middleware/error-handler.js';

// ============================================================================
// BOOKING ERROR CODES
// ============================================================================

export const BOOKING_ERROR_CODES = {
  SEAT_NOT_AVAILABLE: 'SEAT_NOT_AVAILABLE',
  SEAT_ALREADY_SELECTED: 'SEAT_ALREADY_SELECTED',
  SEAT_NOT_FOUND: 'SEAT_NOT_FOUND',
  SESSION_NOT_FOUND: 'SESSION_NOT_FOUND',
  SESSION_NOT_ACTIVE: 'SESSION_NOT_ACTIVE',
  BOOKING_NOT_FOUND: 'BOOKING_NOT_FOUND',
  BOOKING_EXPIRED: 'BOOKING_EXPIRED',
  BOOKING_ALREADY_CONFIRMED: 'BOOKING_ALREADY_CONFIRMED',
  MAX_SEATS_EXCEEDED: 'MAX_SEATS_EXCEEDED',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  UNAUTHORIZED: 'UNAUTHORIZED',
  CONFLICT: 'CONFLICT',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
} as const;

export type BookingErrorCode = (typeof BOOKING_ERROR_CODES)[keyof typeof BOOKING_ERROR_CODES];

// ============================================================================
// CUSTOM ERROR CLASSES
// ============================================================================

export class BookingError extends AppError {
  public readonly code: BookingErrorCode;

  constructor(code: BookingErrorCode, message: string, statusCode: number = 400) {
    super(statusCode, message);
    this.code = code;
    this.name = 'BookingError';
  }
}

export class SeatNotAvailableError extends BookingError {
  public readonly seatId: string;
  public readonly currentStatus: string;

  constructor(seatId: string, currentStatus: string) {
    super(
      BOOKING_ERROR_CODES.SEAT_NOT_AVAILABLE,
      `Seat ${seatId} is not available. Current status: ${currentStatus}`,
      409
    );
    this.seatId = seatId;
    this.currentStatus = currentStatus;
    this.name = 'SeatNotAvailableError';
  }
}

export class SeatAlreadySelectedError extends BookingError {
  public readonly seatId: string;
  public readonly selectedBy: string;

  constructor(seatId: string, selectedBy: string) {
    super(
      BOOKING_ERROR_CODES.SEAT_ALREADY_SELECTED,
      `Seat ${seatId} is already selected by another user`,
      409
    );
    this.seatId = seatId;
    this.selectedBy = selectedBy;
    this.name = 'SeatAlreadySelectedError';
  }
}

export class SeatNotFoundError extends BookingError {
  public readonly seatId: string;

  constructor(seatId: string) {
    super(BOOKING_ERROR_CODES.SEAT_NOT_FOUND, `Seat ${seatId} not found`, 404);
    this.seatId = seatId;
    this.name = 'SeatNotFoundError';
  }
}

export class SessionNotFoundError extends BookingError {
  public readonly sessionId: string;

  constructor(sessionId: string) {
    super(BOOKING_ERROR_CODES.SESSION_NOT_FOUND, `Session ${sessionId} not found`, 404);
    this.sessionId = sessionId;
    this.name = 'SessionNotFoundError';
  }
}

export class SessionNotActiveError extends BookingError {
  public readonly sessionId: string;
  public readonly currentStatus: string;

  constructor(sessionId: string, currentStatus: string) {
    super(
      BOOKING_ERROR_CODES.SESSION_NOT_ACTIVE,
      `Session ${sessionId} is not active for booking. Current status: ${currentStatus}`,
      400
    );
    this.sessionId = sessionId;
    this.currentStatus = currentStatus;
    this.name = 'SessionNotActiveError';
  }
}

export class BookingNotFoundError extends BookingError {
  public readonly bookingId: string;

  constructor(bookingId: string) {
    super(BOOKING_ERROR_CODES.BOOKING_NOT_FOUND, `Booking ${bookingId} not found`, 404);
    this.bookingId = bookingId;
    this.name = 'BookingNotFoundError';
  }
}

export class BookingExpiredError extends BookingError {
  public readonly bookingId: string;

  constructor(bookingId: string) {
    super(
      BOOKING_ERROR_CODES.BOOKING_EXPIRED,
      `Booking ${bookingId} has expired`,
      400
    );
    this.bookingId = bookingId;
    this.name = 'BookingExpiredError';
  }
}

export class MaxSeatsExceededError extends BookingError {
  public readonly maxSeats: number;
  public readonly requestedSeats: number;

  constructor(maxSeats: number, requestedSeats: number) {
    super(
      BOOKING_ERROR_CODES.MAX_SEATS_EXCEEDED,
      `Maximum ${maxSeats} seats allowed per booking. Requested: ${requestedSeats}`,
      400
    );
    this.maxSeats = maxSeats;
    this.requestedSeats = requestedSeats;
    this.name = 'MaxSeatsExceededError';
  }
}

export class RateLimitExceededError extends BookingError {
  public readonly retryAfter: number;

  constructor(retryAfter: number) {
    super(
      BOOKING_ERROR_CODES.RATE_LIMIT_EXCEEDED,
      `Rate limit exceeded. Please wait ${retryAfter} seconds before trying again.`,
      429
    );
    this.retryAfter = retryAfter;
    this.name = 'RateLimitExceededError';
  }
}

export class ConflictError extends BookingError {
  constructor(message: string) {
    super(BOOKING_ERROR_CODES.CONFLICT, message, 409);
    this.name = 'ConflictError';
  }
}

// ============================================================================
// ERROR HELPER
// ============================================================================

export function toErrorEvent(error: unknown): { code: string; message: string; details?: unknown } {
  if (error instanceof BookingError) {
    return {
      code: error.code,
      message: error.message,
      details: getErrorDetails(error),
    };
  }

  if (error instanceof Error) {
    return {
      code: 'UNKNOWN_ERROR',
      message: error.message,
    };
  }

  return {
    code: 'UNKNOWN_ERROR',
    message: 'An unexpected error occurred',
  };
}

function getErrorDetails(error: BookingError): unknown {
  if (error instanceof SeatNotAvailableError) {
    return { seatId: error.seatId, currentStatus: error.currentStatus };
  }
  if (error instanceof SeatAlreadySelectedError) {
    return { seatId: error.seatId, selectedBy: error.selectedBy };
  }
  if (error instanceof SeatNotFoundError) {
    return { seatId: error.seatId };
  }
  if (error instanceof SessionNotFoundError) {
    return { sessionId: error.sessionId };
  }
  if (error instanceof MaxSeatsExceededError) {
    return { maxSeats: error.maxSeats, requestedSeats: error.requestedSeats };
  }
  if (error instanceof RateLimitExceededError) {
    return { retryAfter: error.retryAfter };
  }
  return undefined;
}

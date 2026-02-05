import { AppError } from '../../middleware/error-handler.js';
import { PAYME_ERRORS, CLICK_ERRORS } from './payment.types.js';

// ============================================================================
// ERROR CODES
// ============================================================================

export const PAYMENT_ERROR_CODES = {
  PAYMENT_NOT_FOUND: 'PAYMENT_NOT_FOUND',
  BOOKING_NOT_FOUND: 'BOOKING_NOT_FOUND',
  BOOKING_NOT_PENDING: 'BOOKING_NOT_PENDING',
  INVALID_AMOUNT: 'INVALID_AMOUNT',
  INVALID_SIGNATURE: 'INVALID_SIGNATURE',
  TRANSACTION_NOT_FOUND: 'TRANSACTION_NOT_FOUND',
  TRANSACTION_ALREADY_EXISTS: 'TRANSACTION_ALREADY_EXISTS',
  TRANSACTION_EXPIRED: 'TRANSACTION_EXPIRED',
  CANNOT_PERFORM_OPERATION: 'CANNOT_PERFORM_OPERATION',
  INVALID_STATE: 'INVALID_STATE',
  ALREADY_PAID: 'ALREADY_PAID',
  ALREADY_CANCELLED: 'ALREADY_CANCELLED',
  ALREADY_REFUNDED: 'ALREADY_REFUNDED',
  REFUND_AMOUNT_EXCEEDS: 'REFUND_AMOUNT_EXCEEDS',
  PROVIDER_ERROR: 'PROVIDER_ERROR',
  IDEMPOTENCY_CONFLICT: 'IDEMPOTENCY_CONFLICT',
  MAX_RETRIES_EXCEEDED: 'MAX_RETRIES_EXCEEDED',
} as const;

export type PaymentErrorCode = (typeof PAYMENT_ERROR_CODES)[keyof typeof PAYMENT_ERROR_CODES];

// ============================================================================
// BASE PAYMENT ERROR
// ============================================================================

export class PaymentError extends AppError {
  public readonly code: PaymentErrorCode;
  public readonly providerCode?: number;

  constructor(
    code: PaymentErrorCode,
    message: string,
    statusCode: number = 400,
    providerCode?: number
  ) {
    super(statusCode, message);
    this.code = code;
    this.providerCode = providerCode;
    this.name = 'PaymentError';
  }
}

// ============================================================================
// SPECIFIC ERRORS
// ============================================================================

export class PaymentNotFoundError extends PaymentError {
  constructor(paymentId: string) {
    super(
      PAYMENT_ERROR_CODES.PAYMENT_NOT_FOUND,
      `Payment ${paymentId} not found`,
      404
    );
  }
}

export class BookingNotFoundError extends PaymentError {
  constructor(bookingId: string) {
    super(
      PAYMENT_ERROR_CODES.BOOKING_NOT_FOUND,
      `Booking ${bookingId} not found`,
      404
    );
  }
}

export class BookingNotPendingError extends PaymentError {
  constructor(bookingId: string, currentStatus: string) {
    super(
      PAYMENT_ERROR_CODES.BOOKING_NOT_PENDING,
      `Booking ${bookingId} is not in pending status (current: ${currentStatus})`,
      400
    );
  }
}

export class InvalidAmountError extends PaymentError {
  constructor(expected: number, received: number) {
    super(
      PAYMENT_ERROR_CODES.INVALID_AMOUNT,
      `Invalid amount: expected ${expected}, received ${received}`,
      400,
      PAYME_ERRORS.INVALID_AMOUNT.code
    );
  }
}

export class InvalidSignatureError extends PaymentError {
  constructor() {
    super(
      PAYMENT_ERROR_CODES.INVALID_SIGNATURE,
      'Invalid signature',
      401,
      CLICK_ERRORS.SIGN_CHECK_FAILED
    );
  }
}

export class TransactionNotFoundError extends PaymentError {
  constructor(transactionId: string) {
    super(
      PAYMENT_ERROR_CODES.TRANSACTION_NOT_FOUND,
      `Transaction ${transactionId} not found`,
      404,
      PAYME_ERRORS.TRANSACTION_NOT_FOUND.code
    );
  }
}

export class TransactionAlreadyExistsError extends PaymentError {
  constructor(externalId: string) {
    super(
      PAYMENT_ERROR_CODES.TRANSACTION_ALREADY_EXISTS,
      `Transaction with external ID ${externalId} already exists`,
      409
    );
  }
}

export class CannotPerformOperationError extends PaymentError {
  constructor(reason: string) {
    super(
      PAYMENT_ERROR_CODES.CANNOT_PERFORM_OPERATION,
      `Cannot perform operation: ${reason}`,
      400,
      PAYME_ERRORS.CANNOT_PERFORM.code
    );
  }
}

export class InvalidStateError extends PaymentError {
  constructor(expected: string, current: string) {
    super(
      PAYMENT_ERROR_CODES.INVALID_STATE,
      `Invalid state: expected ${expected}, current ${current}`,
      400,
      PAYME_ERRORS.INVALID_STATE.code
    );
  }
}

export class AlreadyPaidError extends PaymentError {
  constructor(paymentId: string) {
    super(
      PAYMENT_ERROR_CODES.ALREADY_PAID,
      `Payment ${paymentId} is already completed`,
      400,
      CLICK_ERRORS.ALREADY_PAID
    );
  }
}

export class AlreadyCancelledError extends PaymentError {
  constructor(paymentId: string) {
    super(
      PAYMENT_ERROR_CODES.ALREADY_CANCELLED,
      `Payment ${paymentId} is already cancelled`,
      400,
      CLICK_ERRORS.TRANSACTION_CANCELLED
    );
  }
}

export class AlreadyRefundedError extends PaymentError {
  constructor(paymentId: string) {
    super(
      PAYMENT_ERROR_CODES.ALREADY_REFUNDED,
      `Payment ${paymentId} is already fully refunded`,
      400
    );
  }
}

export class RefundAmountExceedsError extends PaymentError {
  constructor(maxRefundable: number, requested: number) {
    super(
      PAYMENT_ERROR_CODES.REFUND_AMOUNT_EXCEEDS,
      `Refund amount ${requested} exceeds maximum refundable ${maxRefundable}`,
      400
    );
  }
}

export class IdempotencyConflictError extends PaymentError {
  constructor(idempotencyKey: string) {
    super(
      PAYMENT_ERROR_CODES.IDEMPOTENCY_CONFLICT,
      `Request with idempotency key ${idempotencyKey} already processed`,
      409
    );
  }
}

export class MaxRetriesExceededError extends PaymentError {
  constructor(transactionId: string, maxRetries: number) {
    super(
      PAYMENT_ERROR_CODES.MAX_RETRIES_EXCEEDED,
      `Transaction ${transactionId} exceeded maximum retries (${maxRetries})`,
      400
    );
  }
}

// ============================================================================
// PAYME SPECIFIC ERROR HELPERS
// ============================================================================

export function createPaymeErrorResponse(
  error: typeof PAYME_ERRORS[keyof typeof PAYME_ERRORS],
  id: number | string,
  data?: string
) {
  return {
    error: {
      code: error.code,
      message: error.message,
      ...(data && { data }),
    },
    id,
  };
}

export function createPaymeSuccessResponse(result: unknown, id: number | string) {
  return { result, id };
}

// ============================================================================
// CLICK SPECIFIC ERROR HELPERS
// ============================================================================

export function createClickErrorResponse(
  errorCode: number,
  errorNote: string,
  clickTransId: number,
  merchantTransId: string
) {
  return {
    click_trans_id: clickTransId,
    merchant_trans_id: merchantTransId,
    error: errorCode,
    error_note: errorNote,
  };
}

export function createClickPrepareSuccessResponse(
  clickTransId: number,
  merchantTransId: string,
  merchantPrepareId: number
) {
  return {
    click_trans_id: clickTransId,
    merchant_trans_id: merchantTransId,
    merchant_prepare_id: merchantPrepareId,
    error: CLICK_ERRORS.SUCCESS,
    error_note: 'Success',
  };
}

export function createClickCompleteSuccessResponse(
  clickTransId: number,
  merchantTransId: string,
  merchantConfirmId: number
) {
  return {
    click_trans_id: clickTransId,
    merchant_trans_id: merchantTransId,
    merchant_confirm_id: merchantConfirmId,
    error: CLICK_ERRORS.SUCCESS,
    error_note: 'Success',
  };
}

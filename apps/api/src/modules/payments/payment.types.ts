import { z } from 'zod';

// ============================================================================
// ENUMS
// ============================================================================

export const PaymentProviderEnum = z.enum(['PAYME', 'CLICK']);
export type PaymentProvider = z.infer<typeof PaymentProviderEnum>;

export const PaymentStatusEnum = z.enum(['PENDING', 'COMPLETED', 'FAILED', 'CANCELLED']);
export type PaymentStatus = z.infer<typeof PaymentStatusEnum>;

export const TransactionTypeEnum = z.enum([
  'CREATE',
  'CHECK',
  'CONFIRM',
  'CANCEL',
  'REFUND',
  'PREPARE',
  'COMPLETE',
]);
export type TransactionType = z.infer<typeof TransactionTypeEnum>;

export const TransactionStatusEnum = z.enum(['PENDING', 'SUCCESS', 'FAILED', 'ERROR']);
export type TransactionStatus = z.infer<typeof TransactionStatusEnum>;

// ============================================================================
// CONFIGURATION
// ============================================================================

export interface PaymeConfig {
  merchantId: string;
  secretKey: string;
  testSecretKey: string;
  baseUrl: string;
  callbackUrl: string;
  returnUrl: string;
  isSandbox: boolean;
}

export interface ClickConfig {
  merchantId: string;
  serviceId: string;
  secretKey: string;
  merchantUserId: string;
  baseUrl: string;
  callbackUrl: string;
  returnUrl: string;
  isSandbox: boolean;
}

export const PAYME_CONFIG: PaymeConfig = {
  merchantId: process.env.PAYME_MERCHANT_ID || '',
  secretKey: process.env.PAYME_SECRET_KEY || '',
  testSecretKey: process.env.PAYME_TEST_SECRET_KEY || '',
  baseUrl: process.env.PAYME_SANDBOX === 'true' 
    ? 'https://checkout.test.paycom.uz' 
    : 'https://checkout.paycom.uz',
  callbackUrl: process.env.PAYME_CALLBACK_URL || 'http://localhost:3001/api/payments/payme/callback',
  returnUrl: process.env.PAYME_RETURN_URL || 'http://localhost:3000/payment/result',
  isSandbox: process.env.PAYME_SANDBOX === 'true',
};

export const CLICK_CONFIG: ClickConfig = {
  merchantId: process.env.CLICK_MERCHANT_ID || '',
  serviceId: process.env.CLICK_SERVICE_ID || '',
  secretKey: process.env.CLICK_SECRET_KEY || '',
  merchantUserId: process.env.CLICK_MERCHANT_USER_ID || '',
  baseUrl: process.env.CLICK_SANDBOX === 'true'
    ? 'https://my.click.uz/services/pay'
    : 'https://my.click.uz/services/pay',
  callbackUrl: process.env.CLICK_CALLBACK_URL || 'http://localhost:3001/api/payments/click',
  returnUrl: process.env.CLICK_RETURN_URL || 'http://localhost:3000/payment/result',
  isSandbox: process.env.CLICK_SANDBOX === 'true',
};

// ============================================================================
// ERROR CODES
// ============================================================================

// Payme error codes
export const PAYME_ERRORS = {
  INVALID_AMOUNT: { code: -31001, message: { uz: 'Noto\'g\'ri summa', ru: 'Неверная сумма', en: 'Invalid amount' } },
  ORDER_NOT_FOUND: { code: -31050, message: { uz: 'Buyurtma topilmadi', ru: 'Заказ не найден', en: 'Order not found' } },
  CANNOT_PERFORM: { code: -31008, message: { uz: 'Operatsiyani bajarib bo\'lmaydi', ru: 'Невозможно выполнить операцию', en: 'Cannot perform operation' } },
  TRANSACTION_NOT_FOUND: { code: -31003, message: { uz: 'Tranzaksiya topilmadi', ru: 'Транзакция не найдена', en: 'Transaction not found' } },
  INVALID_STATE: { code: -31007, message: { uz: 'Noto\'g\'ri holat', ru: 'Неверное состояние', en: 'Invalid state' } },
  ALREADY_DONE: { code: -31060, message: { uz: 'Allaqachon bajarilgan', ru: 'Уже выполнено', en: 'Already done' } },
  UNAUTHORIZED: { code: -32504, message: { uz: 'Ruxsat yo\'q', ru: 'Нет доступа', en: 'Unauthorized' } },
  INVALID_JSON: { code: -32700, message: { uz: 'Noto\'g\'ri JSON', ru: 'Неверный JSON', en: 'Invalid JSON' } },
} as const;

// Click error codes
export const CLICK_ERRORS = {
  SUCCESS: 0,
  SIGN_CHECK_FAILED: -1,
  INCORRECT_PARAMETER: -2,
  ACTION_NOT_FOUND: -3,
  ALREADY_PAID: -4,
  USER_NOT_FOUND: -5,
  TRANSACTION_NOT_FOUND: -6,
  UPDATE_ERROR: -7,
  ERROR_IN_REQUEST: -8,
  TRANSACTION_CANCELLED: -9,
} as const;

// ============================================================================
// REQUEST/RESPONSE SCHEMAS
// ============================================================================

// --- Create Payment ---
export const CreatePaymentSchema = z.object({
  bookingId: z.string().uuid(),
  amount: z.number().positive(),
  provider: PaymentProviderEnum,
});
export type CreatePaymentInput = z.infer<typeof CreatePaymentSchema>;

// --- Payme Callback (JSON-RPC) ---
export const PaymeMethodEnum = z.enum([
  'CheckPerformTransaction',
  'CreateTransaction',
  'PerformTransaction',
  'CancelTransaction',
  'CheckTransaction',
  'GetStatement',
]);
export type PaymeMethod = z.infer<typeof PaymeMethodEnum>;

export const PaymeCallbackSchema = z.object({
  method: PaymeMethodEnum,
  params: z.record(z.unknown()),
  id: z.number().or(z.string()),
});
export type PaymeCallbackInput = z.infer<typeof PaymeCallbackSchema>;

// Payme account structure
export interface PaymeAccount {
  order_id: string;
}

// Payme CheckPerformTransaction params
export interface PaymeCheckPerformParams {
  amount: number;
  account: PaymeAccount;
}

// Payme CreateTransaction params
export interface PaymeCreateTransactionParams {
  id: string;
  time: number;
  amount: number;
  account: PaymeAccount;
}

// Payme PerformTransaction params
export interface PaymePerformTransactionParams {
  id: string;
}

// Payme CancelTransaction params
export interface PaymeCancelTransactionParams {
  id: string;
  reason: number;
}

// Payme CheckTransaction params
export interface PaymeCheckTransactionParams {
  id: string;
}

// Payme GetStatement params
export interface PaymeGetStatementParams {
  from: number;
  to: number;
}

// --- Click Prepare/Complete ---
export const ClickPrepareSchema = z.object({
  click_trans_id: z.coerce.number(),
  service_id: z.coerce.number(),
  click_paydoc_id: z.coerce.number(),
  merchant_trans_id: z.string(),
  amount: z.coerce.number(),
  action: z.coerce.number(),
  error: z.coerce.number(),
  error_note: z.string().optional(),
  sign_time: z.string(),
  sign_string: z.string(),
});
export type ClickPrepareInput = z.infer<typeof ClickPrepareSchema>;

export const ClickCompleteSchema = z.object({
  click_trans_id: z.coerce.number(),
  service_id: z.coerce.number(),
  click_paydoc_id: z.coerce.number(),
  merchant_trans_id: z.string(),
  merchant_prepare_id: z.coerce.number().optional(),
  amount: z.coerce.number(),
  action: z.coerce.number(),
  error: z.coerce.number(),
  error_note: z.string().optional(),
  sign_time: z.string(),
  sign_string: z.string(),
});
export type ClickCompleteInput = z.infer<typeof ClickCompleteSchema>;

// --- Refund ---
export const RefundPaymentSchema = z.object({
  paymentId: z.string().uuid(),
  amount: z.number().positive().optional(), // Optional for full refund
  reason: z.string().min(1).max(500),
});
export type RefundPaymentInput = z.infer<typeof RefundPaymentSchema>;

// --- Check Status ---
export const CheckPaymentSchema = z.object({
  paymentId: z.string().uuid(),
});
export type CheckPaymentInput = z.infer<typeof CheckPaymentSchema>;

// ============================================================================
// RESPONSE TYPES
// ============================================================================

export interface PaymentUrlResponse {
  paymentId: string;
  paymentUrl: string;
  provider: PaymentProvider;
  amount: number;
  expiresAt: string;
}

export interface PaymentStatusResponse {
  paymentId: string;
  bookingId: string;
  provider: PaymentProvider;
  status: PaymentStatus;
  amount: number;
  externalId: string | null;
  paidAt: string | null;
  refundedAmount: number | null;
  refundedAt: string | null;
  transactions: TransactionLogEntry[];
}

export interface TransactionLogEntry {
  id: string;
  type: TransactionType;
  status: TransactionStatus;
  externalId: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: string;
}

export interface RefundResponse {
  paymentId: string;
  refundedAmount: number;
  status: string;
  refundedAt: string;
}

// ============================================================================
// CLICK RESPONSE TYPES
// ============================================================================

export interface ClickPrepareResponse {
  click_trans_id: number;
  merchant_trans_id: string;
  merchant_prepare_id: number;
  error: number;
  error_note: string;
}

export interface ClickCompleteResponse {
  click_trans_id: number;
  merchant_trans_id: string;
  merchant_confirm_id: number;
  error: number;
  error_note: string;
}

// ============================================================================
// PAYME RESPONSE TYPES
// ============================================================================

export interface PaymeSuccessResponse {
  result: unknown;
  id: number | string;
}

export interface PaymeErrorResponse {
  error: {
    code: number;
    message: {
      uz: string;
      ru: string;
      en: string;
    };
    data?: string;
  };
  id: number | string;
}

export type PaymeResponse = PaymeSuccessResponse | PaymeErrorResponse;

// ============================================================================
// PAYMENT TYPES
// ============================================================================

export type PaymentProvider = 'PAYME' | 'CLICK';
export type PaymentStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
export type TransactionType = 'CREATE' | 'CHECK' | 'CONFIRM' | 'CANCEL' | 'REFUND' | 'PREPARE' | 'COMPLETE';
export type TransactionStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'ERROR';

// ============================================================================
// REQUEST/RESPONSE TYPES
// ============================================================================

export interface CreatePaymentInput {
  bookingId: string;
  amount: number;
  provider: PaymentProvider;
}

export interface PaymentUrlResponse {
  paymentId: string;
  paymentUrl: string;
  provider: PaymentProvider;
  amount: number;
  expiresAt: string;
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

export interface RefundInput {
  paymentId: string;
  amount?: number;
  reason: string;
}

export interface RefundResponse {
  paymentId: string;
  refundedAmount: number;
  status: string;
  refundedAt: string;
}

export interface PaymentListItem {
  id: string;
  bookingId: string;
  provider: PaymentProvider;
  status: PaymentStatus;
  amount: number;
  externalId: string | null;
  paidAt: string | null;
  createdAt: string;
  booking: {
    session: { id: string; name: string };
    seat: { id: string; row: string; number: string };
  };
}

export interface PaymentListResponse {
  payments: PaymentListItem[];
  total: number;
  page: number;
  totalPages: number;
}

// ============================================================================
// HOOK TYPES
// ============================================================================

export interface UsePaymentOptions {
  provider: PaymentProvider;
  onSuccess?: (payment: PaymentStatusResponse) => void;
  onError?: (error: Error) => void;
  onCancel?: () => void;
  testMode?: boolean;
}

export interface UsePaymentReturn {
  // State
  isLoading: boolean;
  isProcessing: boolean;
  error: Error | null;
  payment: PaymentStatusResponse | null;
  paymentUrl: string | null;
  
  // Actions
  createPayment: (bookingId: string, amount: number) => Promise<PaymentUrlResponse>;
  checkStatus: (paymentId: string) => Promise<PaymentStatusResponse>;
  refund: (input: RefundInput) => Promise<RefundResponse>;
  openPaymentWindow: () => void;
  reset: () => void;
  
  // Test mode
  simulateSuccess: () => void;
  simulateFailure: (errorMessage?: string) => void;
}

// ============================================================================
// PAYMENT BUTTON TYPES
// ============================================================================

export interface PaymentButtonProps {
  bookingId: string;
  amount: number;
  provider: PaymentProvider;
  onSuccess?: (payment: PaymentStatusResponse) => void;
  onError?: (error: Error) => void;
  onCancel?: () => void;
  disabled?: boolean;
  className?: string;
  testMode?: boolean;
}

export interface PaymentMethodSelectorProps {
  bookingId: string;
  amount: number;
  onSuccess?: (payment: PaymentStatusResponse) => void;
  onError?: (error: Error) => void;
  onCancel?: () => void;
  disabled?: boolean;
  className?: string;
  testMode?: boolean;
  enabledProviders?: PaymentProvider[];
}

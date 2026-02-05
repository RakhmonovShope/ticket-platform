// ============================================================================
// API REQUEST/RESPONSE TYPES
// ============================================================================

import type {
  UUID,
  PaginatedResponse,
  SessionStatus,
  SeatStatus,
  BookingStatus,
  PaymentProvider,
  PaymentStatus,
  UserRole,
  Venue,
  Session,
  Seat,
  Tariff,
  Booking,
  Payment,
} from './index';

// ============================================================================
// AUTH
// ============================================================================

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: {
    id: UUID;
    email: string;
    name: string;
    role: UserRole;
  };
  token: string;
  expiresAt: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
  phone?: string;
}

// ============================================================================
// VENUES
// ============================================================================

export interface CreateVenueRequest {
  name: string;
  address: string;
  description?: string;
  schema: Record<string, unknown>;
  capacity: number;
}

export interface UpdateVenueRequest {
  name?: string;
  address?: string;
  description?: string;
  schema?: Record<string, unknown>;
  capacity?: number;
  isActive?: boolean;
}

export interface VenueListResponse extends PaginatedResponse<Venue> {}

export interface VenueDetailResponse extends Venue {
  sessions: Array<{
    id: UUID;
    name: string;
    status: SessionStatus;
    startTime: string;
  }>;
}

// ============================================================================
// SESSIONS
// ============================================================================

export interface CreateSessionRequest {
  venueId: UUID;
  name: string;
  description?: string;
  startTime: string;
  endTime: string;
}

export interface UpdateSessionRequest {
  name?: string;
  description?: string;
  startTime?: string;
  endTime?: string;
}

export interface SessionListQuery {
  status?: SessionStatus;
  venueId?: UUID;
  search?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
  sortBy?: 'startTime' | 'createdAt' | 'name';
  sortOrder?: 'asc' | 'desc';
}

export interface SessionListResponse extends PaginatedResponse<SessionListItem> {}

export interface SessionListItem {
  id: UUID;
  name: string;
  status: SessionStatus;
  startTime: string;
  endTime: string;
  venue: {
    id: UUID;
    name: string;
  };
  _count: {
    seats: number;
    bookings: number;
  };
}

export interface SessionDetailResponse extends Session {
  venue: Venue;
  tariffs: TariffWithSeatCount[];
  seats: SeatWithTariff[];
  stats: SessionStats;
}

export interface SessionStats {
  totalSeats: number;
  availableSeats: number;
  reservedSeats: number;
  occupiedSeats: number;
  seatsWithTariff: number;
  seatsWithoutTariff: number;
  revenue: {
    potential: number;
    confirmed: number;
  };
}

export interface TariffWithSeatCount extends Tariff {
  seatCount: number;
}

export interface SeatWithTariff extends Seat {
  tariff?: {
    id: UUID;
    name: string;
    price: number;
    color: string;
  } | null;
}

export interface DuplicateSessionRequest {
  startTime: string;
  endTime: string;
  name?: string;
  copyTariffs?: boolean;
}

// ============================================================================
// TARIFFS
// ============================================================================

export interface CreateTariffRequest {
  name: string;
  price: number;
  color: string;
  description?: string;
  isActive?: boolean;
}

export interface UpdateTariffRequest {
  name?: string;
  price?: number;
  color?: string;
  description?: string;
  isActive?: boolean;
}

export interface AssignSeatsRequest {
  seatIds: UUID[];
}

export interface BulkAssignRequest {
  assignments: Array<{
    tariffId: UUID;
    filter: {
      section?: string;
      rowRange?: { start: string; end: string };
      seatRange?: { start: number; end: number };
    };
  }>;
}

export interface AutoAssignRequest {
  tariffIds: UUID[];
  strategy: 'equal_sections' | 'by_row' | 'by_distance_from_stage';
}

// ============================================================================
// BOOKINGS
// ============================================================================

export interface CreateBookingRequest {
  sessionId: UUID;
  seatId: UUID;
  guestEmail?: string;
  guestPhone?: string;
}

export interface BookingListQuery {
  sessionId?: UUID;
  userId?: UUID;
  status?: BookingStatus;
  page?: number;
  limit?: number;
}

export interface BookingDetailResponse extends Booking {
  session: {
    id: UUID;
    name: string;
    startTime: string;
    venue: {
      id: UUID;
      name: string;
      address: string;
    };
  };
  seat: {
    id: UUID;
    row: string;
    number: string;
    section?: string | null;
  };
  tariff?: {
    id: UUID;
    name: string;
    price: number;
  } | null;
  payment?: Payment | null;
}

// ============================================================================
// PAYMENTS
// ============================================================================

export interface CreatePaymentRequest {
  bookingId: UUID;
  amount: number;
  provider: PaymentProvider;
}

export interface PaymentUrlResponse {
  paymentId: UUID;
  paymentUrl: string;
  provider: PaymentProvider;
  amount: number;
  expiresAt: string;
}

export interface PaymentStatusResponse {
  paymentId: UUID;
  bookingId: UUID;
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
  id: UUID;
  type: 'CREATE' | 'CHECK' | 'CONFIRM' | 'CANCEL' | 'REFUND' | 'PREPARE' | 'COMPLETE';
  status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'ERROR';
  externalId: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: string;
}

export interface RefundRequest {
  paymentId: UUID;
  amount?: number;
  reason: string;
}

export interface RefundResponse {
  paymentId: UUID;
  refundedAmount: number;
  status: string;
  refundedAt: string;
}

export interface PaymentListQuery {
  bookingId?: UUID;
  provider?: PaymentProvider;
  status?: PaymentStatus;
  page?: number;
  limit?: number;
}

// ============================================================================
// HEALTH & SYSTEM
// ============================================================================

export interface HealthResponse {
  status: 'ok' | 'degraded' | 'error';
  timestamp: string;
  version?: string;
  services?: {
    database: 'ok' | 'error';
    redis: 'ok' | 'error';
    websocket: 'ok' | 'error';
  };
}

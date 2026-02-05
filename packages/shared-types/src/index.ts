// ============================================================================
// SHARED TYPES - INDEX
// ============================================================================

// Re-export all types
export * from './api';
export * from './socket';

// ============================================================================
// COMMON TYPES
// ============================================================================

export type UUID = string;

export interface Timestamps {
  createdAt: string;
  updatedAt: string;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  totalPages: number;
  hasMore: boolean;
}

export interface ApiError {
  message: string;
  code?: string;
  statusCode: number;
  errors?: Array<{
    field: string;
    message: string;
  }>;
}

// ============================================================================
// ENUMS
// ============================================================================

export enum UserRole {
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  USER = 'USER',
}

export enum SessionStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  SOLD_OUT = 'SOLD_OUT',
  CANCELLED = 'CANCELLED',
  COMPLETED = 'COMPLETED',
}

export enum SeatStatus {
  AVAILABLE = 'AVAILABLE',
  RESERVED = 'RESERVED',
  OCCUPIED = 'OCCUPIED',
  DISABLED = 'DISABLED',
  HIDDEN = 'HIDDEN',
}

export enum BookingStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
}

export enum PaymentProvider {
  PAYME = 'PAYME',
  CLICK = 'CLICK',
  UZCARD = 'UZCARD',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

// ============================================================================
// ENTITY TYPES
// ============================================================================

export interface User extends Timestamps {
  id: UUID;
  email: string;
  name: string;
  role: UserRole;
  phone?: string | null;
}

export interface Venue extends Timestamps {
  id: UUID;
  name: string;
  address: string;
  description?: string | null;
  schema: VenueSchema;
  capacity: number;
  isActive: boolean;
}

export interface VenueSchema {
  rows?: number;
  columns?: number;
  sections?: VenueSection[];
  seats?: VenueSeatDefinition[];
}

export interface VenueSection {
  id: string;
  name: string;
  rows: number;
  columns: number;
  x: number;
  y: number;
}

export interface VenueSeatDefinition {
  id: string;
  row: string;
  number: string;
  section?: string;
  x: number;
  y: number;
  type?: 'regular' | 'vip' | 'accessible';
}

export interface Session extends Timestamps {
  id: UUID;
  venueId: UUID;
  name: string;
  description?: string | null;
  startTime: string;
  endTime: string;
  status: SessionStatus;
  isActive: boolean;
}

export interface Seat extends Timestamps {
  id: UUID;
  sessionId: UUID;
  row: string;
  number: string;
  section?: string | null;
  x: number;
  y: number;
  width?: number | null;
  height?: number | null;
  rotation?: number | null;
  status: SeatStatus;
}

export interface Tariff extends Timestamps {
  id: UUID;
  sessionId: UUID;
  name: string;
  price: number;
  color?: string | null;
  description?: string | null;
  isActive: boolean;
}

export interface Booking extends Timestamps {
  id: UUID;
  sessionId: UUID;
  seatId: UUID;
  userId?: UUID | null;
  guestEmail?: string | null;
  guestPhone?: string | null;
  status: BookingStatus;
  expiresAt: string;
  totalPrice: number;
}

export interface Payment extends Timestamps {
  id: UUID;
  bookingId: UUID;
  userId?: UUID | null;
  amount: number;
  provider: PaymentProvider;
  status: PaymentStatus;
  externalId?: string | null;
  paidAt?: string | null;
  refundedAmount?: number | null;
  refundedAt?: string | null;
  refundReason?: string | null;
}

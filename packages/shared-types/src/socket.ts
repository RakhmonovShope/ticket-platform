// ============================================================================
// WEBSOCKET EVENT TYPES
// ============================================================================

import type { UUID, SeatStatus, BookingStatus, PaymentStatus } from './index';

// ============================================================================
// CLIENT -> SERVER EVENTS
// ============================================================================

export interface ClientToServerEvents {
  // Session Events
  'join_session': (data: JoinSessionPayload) => void;
  'leave_session': (data: LeaveSessionPayload) => void;
  
  // Booking Events
  'reserve_seat': (data: ReserveSeatPayload) => void;
  'release_seat': (data: ReleaseSeatPayload) => void;
  'confirm_booking': (data: ConfirmBookingPayload) => void;
  'cancel_booking': (data: CancelBookingPayload) => void;
  
  // Presence
  'ping': () => void;
}

// ============================================================================
// SERVER -> CLIENT EVENTS
// ============================================================================

export interface ServerToClientEvents {
  // Connection Events
  'connected': (data: ConnectedPayload) => void;
  'error': (data: ErrorPayload) => void;
  
  // Session Events
  'session_joined': (data: SessionJoinedPayload) => void;
  'session_left': (data: SessionLeftPayload) => void;
  'session_published': (data: SessionPublishedPayload) => void;
  'session_cancelled': (data: SessionCancelledPayload) => void;
  
  // Seat Events
  'seat_status_changed': (data: SeatStatusChangedPayload) => void;
  'seats_updated': (data: SeatsUpdatedPayload) => void;
  
  // Booking Events
  'seat_reserved': (data: SeatReservedPayload) => void;
  'seat_released': (data: SeatReleasedPayload) => void;
  'booking_confirmed': (data: BookingConfirmedPayload) => void;
  'booking_cancelled': (data: BookingCancelledPayload) => void;
  'booking_expired': (data: BookingExpiredPayload) => void;
  
  // Payment Events
  'payment_created': (data: PaymentCreatedPayload) => void;
  'payment_completed': (data: PaymentCompletedPayload) => void;
  'payment_cancelled': (data: PaymentCancelledPayload) => void;
  'payment_refunded': (data: PaymentRefundedPayload) => void;
  
  // Presence
  'user_joined': (data: UserPresencePayload) => void;
  'user_left': (data: UserPresencePayload) => void;
  'viewer_count': (data: ViewerCountPayload) => void;
  'pong': () => void;
}

// ============================================================================
// PAYLOAD TYPES - CLIENT TO SERVER
// ============================================================================

export interface JoinSessionPayload {
  sessionId: UUID;
}

export interface LeaveSessionPayload {
  sessionId: UUID;
}

export interface ReserveSeatPayload {
  sessionId: UUID;
  seatId: UUID;
  guestEmail?: string;
  guestPhone?: string;
}

export interface ReleaseSeatPayload {
  sessionId: UUID;
  seatId: UUID;
  bookingId?: UUID;
}

export interface ConfirmBookingPayload {
  bookingId: UUID;
}

export interface CancelBookingPayload {
  bookingId: UUID;
  reason?: string;
}

// ============================================================================
// PAYLOAD TYPES - SERVER TO CLIENT
// ============================================================================

export interface ConnectedPayload {
  socketId: string;
  userId?: UUID;
  isGuest: boolean;
}

export interface ErrorPayload {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface SessionJoinedPayload {
  sessionId: UUID;
  name: string;
  seats: Array<{
    id: UUID;
    row: string;
    number: string;
    status: SeatStatus;
    tariff?: {
      id: UUID;
      name: string;
      price: number;
      color: string;
    } | null;
  }>;
  viewerCount: number;
}

export interface SessionLeftPayload {
  sessionId: UUID;
}

export interface SessionPublishedPayload {
  sessionId: UUID;
  name: string;
  status: 'ACTIVE';
}

export interface SessionCancelledPayload {
  sessionId: UUID;
  name: string;
  reason?: string;
}

export interface SeatStatusChangedPayload {
  sessionId: UUID;
  seatId: UUID;
  status: SeatStatus;
  userId?: UUID;
  expiresAt?: string;
}

export interface SeatsUpdatedPayload {
  sessionId: UUID;
  seats: Array<{
    id: UUID;
    status: SeatStatus;
    userId?: UUID;
    expiresAt?: string;
  }>;
}

export interface SeatReservedPayload {
  sessionId: UUID;
  seatId: UUID;
  bookingId: UUID;
  userId?: UUID;
  expiresAt: string;
}

export interface SeatReleasedPayload {
  sessionId: UUID;
  seatId: UUID;
  previousStatus: SeatStatus;
}

export interface BookingConfirmedPayload {
  bookingId: UUID;
  sessionId: UUID;
  seatId: UUID;
  status: 'CONFIRMED';
}

export interface BookingCancelledPayload {
  bookingId: UUID;
  sessionId: UUID;
  seatId: UUID;
  reason?: string;
}

export interface BookingExpiredPayload {
  bookingId: UUID;
  sessionId: UUID;
  seatId: UUID;
}

export interface PaymentCreatedPayload {
  paymentId: UUID;
  bookingId: UUID;
  provider: string;
  amount: number;
}

export interface PaymentCompletedPayload {
  paymentId: UUID;
  provider: string;
}

export interface PaymentCancelledPayload {
  paymentId: UUID;
  provider: string;
}

export interface PaymentRefundedPayload {
  paymentId: UUID;
  refundedAmount: number;
  provider: string;
}

export interface UserPresencePayload {
  sessionId: UUID;
  userId?: UUID;
  socketId: string;
  isGuest: boolean;
}

export interface ViewerCountPayload {
  sessionId: UUID;
  count: number;
}

// ============================================================================
// SOCKET MIDDLEWARE TYPES
// ============================================================================

export interface SocketAuthPayload {
  token?: string;
  guestId?: string;
}

export interface AuthenticatedSocket {
  userId?: UUID;
  isGuest: boolean;
  sessionRooms: Set<string>;
}

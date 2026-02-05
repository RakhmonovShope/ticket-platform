import { z } from 'zod';

// ============================================================================
// SOCKET EVENT SCHEMAS (Client -> Server)
// ============================================================================

export const JoinSessionSchema = z.object({
  sessionId: z.string().uuid(),
});

export const LeaveSessionSchema = z.object({
  sessionId: z.string().uuid(),
});

export const SelectSeatSchema = z.object({
  sessionId: z.string().uuid(),
  seatId: z.string().uuid(),
});

export const ReserveSeatsSchema = z.object({
  sessionId: z.string().uuid(),
  seatIds: z.array(z.string().uuid()).min(1).max(10),
});

export const ReleaseSeatsSchema = z.object({
  sessionId: z.string().uuid(),
  seatIds: z.array(z.string().uuid()).min(1),
});

// ============================================================================
// TYPE INFERENCE
// ============================================================================

export type JoinSessionPayload = z.infer<typeof JoinSessionSchema>;
export type LeaveSessionPayload = z.infer<typeof LeaveSessionSchema>;
export type SelectSeatPayload = z.infer<typeof SelectSeatSchema>;
export type ReserveSeatsPayload = z.infer<typeof ReserveSeatsSchema>;
export type ReleaseSeatsPayload = z.infer<typeof ReleaseSeatsSchema>;

// ============================================================================
// SERVER -> CLIENT EVENT PAYLOADS
// ============================================================================

export interface SeatReservedEvent {
  seatId: string;
  reservedBy: string; // 'you' or anonymous userId
  expiresAt: number; // Unix timestamp
  bookingId?: string;
}

export interface SeatReleasedEvent {
  seatId: string;
  reason: 'timeout' | 'cancelled' | 'payment_failed' | 'manual';
}

export interface SeatSelectedEvent {
  seatId: string;
  selectedBy: string; // 'you' or 'another_user'
}

export interface BookingConfirmedEvent {
  bookingId: string;
  seats: Array<{
    seatId: string;
    row: string;
    number: string;
    section: string;
    price: number;
  }>;
  totalPrice: number;
}

export interface SessionUpdatedEvent {
  sessionId: string;
  status: 'DRAFT' | 'ACTIVE' | 'SOLD_OUT' | 'CANCELLED' | 'COMPLETED';
  availableSeats?: number;
}

export interface SessionStateEvent {
  sessionId: string;
  seats: Array<{
    seatId: string;
    status: 'AVAILABLE' | 'RESERVED' | 'OCCUPIED' | 'DISABLED' | 'HIDDEN';
    reservedBy?: string;
    expiresAt?: number;
  }>;
  usersOnline: number;
}

export interface ErrorEvent {
  code: string;
  message: string;
  details?: unknown;
}

// ============================================================================
// SOCKET EVENT NAMES
// ============================================================================

export const SOCKET_EVENTS = {
  // Client -> Server
  JOIN_SESSION: 'join_session',
  LEAVE_SESSION: 'leave_session',
  SELECT_SEAT: 'select_seat',
  RESERVE_SEATS: 'reserve_seats',
  RELEASE_SEATS: 'release_seats',

  // Server -> Client
  SEAT_RESERVED: 'seat_reserved',
  SEAT_RELEASED: 'seat_released',
  SEAT_SELECTED: 'seat_selected',
  BOOKING_CONFIRMED: 'booking_confirmed',
  SESSION_UPDATED: 'session_updated',
  SESSION_STATE: 'session_state',
  ERROR: 'error',
  RATE_LIMITED: 'rate_limited',

  // Connection events
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  CONNECT_ERROR: 'connect_error',
} as const;

// ============================================================================
// SOCKET INTERFACE TYPES (for Socket.io typing)
// ============================================================================

export interface ClientToServerEvents {
  [SOCKET_EVENTS.JOIN_SESSION]: (
    payload: JoinSessionPayload,
    callback: (response: { success: boolean; error?: string }) => void
  ) => void;
  [SOCKET_EVENTS.LEAVE_SESSION]: (payload: LeaveSessionPayload) => void;
  [SOCKET_EVENTS.SELECT_SEAT]: (
    payload: SelectSeatPayload,
    callback: (response: { success: boolean; error?: string }) => void
  ) => void;
  [SOCKET_EVENTS.RESERVE_SEATS]: (
    payload: ReserveSeatsPayload,
    callback: (response: { success: boolean; bookingId?: string; error?: string }) => void
  ) => void;
  [SOCKET_EVENTS.RELEASE_SEATS]: (
    payload: ReleaseSeatsPayload,
    callback: (response: { success: boolean; error?: string }) => void
  ) => void;
}

export interface ServerToClientEvents {
  [SOCKET_EVENTS.SEAT_RESERVED]: (event: SeatReservedEvent) => void;
  [SOCKET_EVENTS.SEAT_RELEASED]: (event: SeatReleasedEvent) => void;
  [SOCKET_EVENTS.SEAT_SELECTED]: (event: SeatSelectedEvent) => void;
  [SOCKET_EVENTS.BOOKING_CONFIRMED]: (event: BookingConfirmedEvent) => void;
  [SOCKET_EVENTS.SESSION_UPDATED]: (event: SessionUpdatedEvent) => void;
  [SOCKET_EVENTS.SESSION_STATE]: (event: SessionStateEvent) => void;
  [SOCKET_EVENTS.ERROR]: (event: ErrorEvent) => void;
  [SOCKET_EVENTS.RATE_LIMITED]: (event: { retryAfter: number }) => void;
}

export interface InterServerEvents {
  ping: () => void;
}

export interface SocketData {
  userId: string;
  email: string;
  role: 'ADMIN' | 'MANAGER' | 'USER';
  joinedSessions: Set<string>;
}

// ============================================================================
// CONSTANTS
// ============================================================================

export const BOOKING_CONFIG = {
  /** TTL for temporary seat selection (5 minutes) */
  SELECTION_TTL_SECONDS: 5 * 60,

  /** TTL for reserved seats awaiting payment (10 minutes) */
  RESERVATION_TTL_SECONDS: 10 * 60,

  /** Maximum seats per booking */
  MAX_SEATS_PER_BOOKING: 10,

  /** Rate limit: max seat selections per minute */
  RATE_LIMIT_SELECTIONS_PER_MINUTE: 10,

  /** Rate limit window in seconds */
  RATE_LIMIT_WINDOW_SECONDS: 60,

  /** Expiration check interval (30 seconds) */
  EXPIRATION_CHECK_INTERVAL_MS: 30 * 1000,
} as const;

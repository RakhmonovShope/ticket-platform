'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { io, Socket } from 'socket.io-client';

// ============================================================================
// TYPES (matching server types)
// ============================================================================

export interface SeatReservedEvent {
  seatId: string;
  reservedBy: string;
  expiresAt: number;
  bookingId?: string;
}

export interface SeatReleasedEvent {
  seatId: string;
  reason: 'timeout' | 'cancelled' | 'payment_failed' | 'manual';
}

export interface SeatSelectedEvent {
  seatId: string;
  selectedBy: string;
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
// SOCKET EVENTS
// ============================================================================

const SOCKET_EVENTS = {
  JOIN_SESSION: 'join_session',
  LEAVE_SESSION: 'leave_session',
  SELECT_SEAT: 'select_seat',
  RESERVE_SEATS: 'reserve_seats',
  RELEASE_SEATS: 'release_seats',
  SEAT_RESERVED: 'seat_reserved',
  SEAT_RELEASED: 'seat_released',
  SEAT_SELECTED: 'seat_selected',
  BOOKING_CONFIRMED: 'booking_confirmed',
  SESSION_UPDATED: 'session_updated',
  SESSION_STATE: 'session_state',
  ERROR: 'error',
  RATE_LIMITED: 'rate_limited',
} as const;

// ============================================================================
// HOOK OPTIONS
// ============================================================================

export interface UseBookingSocketOptions {
  /** WebSocket server URL */
  url: string;
  /** JWT token for authentication */
  token: string;
  /** Session ID to join */
  sessionId: string;
  /** Auto-reconnect on disconnect */
  autoReconnect?: boolean;
  /** Reconnection delay in ms */
  reconnectDelay?: number;
  /** Max reconnection attempts */
  maxReconnectAttempts?: number;

  // Event callbacks
  onSessionState?: (event: SessionStateEvent) => void;
  onSeatReserved?: (event: SeatReservedEvent) => void;
  onSeatReleased?: (event: SeatReleasedEvent) => void;
  onSeatSelected?: (event: SeatSelectedEvent) => void;
  onBookingConfirmed?: (event: BookingConfirmedEvent) => void;
  onSessionUpdated?: (event: SessionUpdatedEvent) => void;
  onError?: (event: ErrorEvent) => void;
  onRateLimited?: (retryAfter: number) => void;
  onConnect?: () => void;
  onDisconnect?: (reason: string) => void;
}

// ============================================================================
// HOOK RETURN TYPE
// ============================================================================

export interface UseBookingSocketReturn {
  /** Whether socket is connected */
  isConnected: boolean;
  /** Whether currently joining/leaving session */
  isJoining: boolean;
  /** Last error that occurred */
  error: ErrorEvent | null;

  // Actions
  /** Select a seat (temporary hold) */
  selectSeat: (seatId: string) => Promise<{ success: boolean; error?: string }>;
  /** Reserve seats (create booking) */
  reserveSeats: (seatIds: string[]) => Promise<{ success: boolean; bookingId?: string; error?: string }>;
  /** Release seats */
  releaseSeats: (seatIds: string[]) => Promise<{ success: boolean; error?: string }>;
  /** Manually disconnect */
  disconnect: () => void;
  /** Manually reconnect */
  reconnect: () => void;
}

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

export function useBookingSocket(options: UseBookingSocketOptions): UseBookingSocketReturn {
  const {
    url,
    token,
    sessionId,
    autoReconnect = true,
    reconnectDelay = 1000,
    maxReconnectAttempts = 5,
    onSessionState,
    onSeatReserved,
    onSeatReleased,
    onSeatSelected,
    onBookingConfirmed,
    onSessionUpdated,
    onError,
    onRateLimited,
    onConnect,
    onDisconnect,
  } = options;

  const socketRef = useRef<Socket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const [isConnected, setIsConnected] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<ErrorEvent | null>(null);

  // ===========================================================================
  // SOCKET SETUP
  // ===========================================================================

  const setupSocket = useCallback(() => {
    // Create socket connection to /bookings namespace
    const socket = io(`${url}/bookings`, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: false, // We handle reconnection manually
    });

    // Connection events
    socket.on('connect', () => {
      console.log('[BookingSocket] Connected');
      setIsConnected(true);
      reconnectAttemptsRef.current = 0;
      setError(null);
      onConnect?.();

      // Join session after connection
      setIsJoining(true);
      socket.emit(
        SOCKET_EVENTS.JOIN_SESSION,
        { sessionId },
        (response: { success: boolean; error?: string }) => {
          setIsJoining(false);
          if (!response.success) {
            setError({ code: 'JOIN_FAILED', message: response.error || 'Failed to join session' });
          }
        }
      );
    });

    socket.on('disconnect', (reason) => {
      console.log('[BookingSocket] Disconnected:', reason);
      setIsConnected(false);
      onDisconnect?.(reason);

      // Auto-reconnect logic
      if (autoReconnect && reconnectAttemptsRef.current < maxReconnectAttempts) {
        reconnectAttemptsRef.current++;
        console.log(`[BookingSocket] Reconnecting (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})...`);
        setTimeout(() => {
          if (socketRef.current) {
            socketRef.current.connect();
          }
        }, reconnectDelay * reconnectAttemptsRef.current);
      }
    });

    socket.on('connect_error', (err) => {
      console.error('[BookingSocket] Connection error:', err.message);
      setError({ code: 'CONNECTION_ERROR', message: err.message });
    });

    // Business events
    socket.on(SOCKET_EVENTS.SESSION_STATE, (event: SessionStateEvent) => {
      onSessionState?.(event);
    });

    socket.on(SOCKET_EVENTS.SEAT_RESERVED, (event: SeatReservedEvent) => {
      onSeatReserved?.(event);
    });

    socket.on(SOCKET_EVENTS.SEAT_RELEASED, (event: SeatReleasedEvent) => {
      onSeatReleased?.(event);
    });

    socket.on(SOCKET_EVENTS.SEAT_SELECTED, (event: SeatSelectedEvent) => {
      onSeatSelected?.(event);
    });

    socket.on(SOCKET_EVENTS.BOOKING_CONFIRMED, (event: BookingConfirmedEvent) => {
      onBookingConfirmed?.(event);
    });

    socket.on(SOCKET_EVENTS.SESSION_UPDATED, (event: SessionUpdatedEvent) => {
      onSessionUpdated?.(event);
    });

    socket.on(SOCKET_EVENTS.ERROR, (event: ErrorEvent) => {
      setError(event);
      onError?.(event);
    });

    socket.on(SOCKET_EVENTS.RATE_LIMITED, (event: { retryAfter: number }) => {
      onRateLimited?.(event.retryAfter);
    });

    socketRef.current = socket;

    return socket;
  }, [
    url,
    token,
    sessionId,
    autoReconnect,
    reconnectDelay,
    maxReconnectAttempts,
    onSessionState,
    onSeatReserved,
    onSeatReleased,
    onSeatSelected,
    onBookingConfirmed,
    onSessionUpdated,
    onError,
    onRateLimited,
    onConnect,
    onDisconnect,
  ]);

  // ===========================================================================
  // LIFECYCLE
  // ===========================================================================

  useEffect(() => {
    const socket = setupSocket();

    return () => {
      // Leave session before disconnecting
      socket.emit(SOCKET_EVENTS.LEAVE_SESSION, { sessionId });
      socket.disconnect();
      socketRef.current = null;
    };
  }, [setupSocket, sessionId]);

  // ===========================================================================
  // ACTIONS
  // ===========================================================================

  const selectSeat = useCallback(
    async (seatId: string): Promise<{ success: boolean; error?: string }> => {
      return new Promise((resolve) => {
        if (!socketRef.current?.connected) {
          resolve({ success: false, error: 'Not connected' });
          return;
        }

        socketRef.current.emit(
          SOCKET_EVENTS.SELECT_SEAT,
          { sessionId, seatId },
          (response: { success: boolean; error?: string }) => {
            resolve(response);
          }
        );
      });
    },
    [sessionId]
  );

  const reserveSeats = useCallback(
    async (seatIds: string[]): Promise<{ success: boolean; bookingId?: string; error?: string }> => {
      return new Promise((resolve) => {
        if (!socketRef.current?.connected) {
          resolve({ success: false, error: 'Not connected' });
          return;
        }

        socketRef.current.emit(
          SOCKET_EVENTS.RESERVE_SEATS,
          { sessionId, seatIds },
          (response: { success: boolean; bookingId?: string; error?: string }) => {
            resolve(response);
          }
        );
      });
    },
    [sessionId]
  );

  const releaseSeats = useCallback(
    async (seatIds: string[]): Promise<{ success: boolean; error?: string }> => {
      return new Promise((resolve) => {
        if (!socketRef.current?.connected) {
          resolve({ success: false, error: 'Not connected' });
          return;
        }

        socketRef.current.emit(
          SOCKET_EVENTS.RELEASE_SEATS,
          { sessionId, seatIds },
          (response: { success: boolean; error?: string }) => {
            resolve(response);
          }
        );
      });
    },
    [sessionId]
  );

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.emit(SOCKET_EVENTS.LEAVE_SESSION, { sessionId });
      socketRef.current.disconnect();
    }
  }, [sessionId]);

  const reconnect = useCallback(() => {
    if (socketRef.current && !socketRef.current.connected) {
      reconnectAttemptsRef.current = 0;
      socketRef.current.connect();
    }
  }, []);

  return {
    isConnected,
    isJoining,
    error,
    selectSeat,
    reserveSeats,
    releaseSeats,
    disconnect,
    reconnect,
  };
}

export default useBookingSocket;

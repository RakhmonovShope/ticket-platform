// ============================================================================
// SHARED TYPES FOR SESSION COMPONENTS
// ============================================================================

export type SessionStatus = 'DRAFT' | 'ACTIVE' | 'SOLD_OUT' | 'CANCELLED' | 'COMPLETED';

export interface Venue {
  id: string;
  name: string;
  address: string;
  capacity: number;
  schema: VenueSchema | null;
}

export interface VenueSchema {
  rows?: number;
  columns?: number;
  sections?: VenueSection[];
  seats?: VenueSeat[];
}

export interface VenueSection {
  id: string;
  name: string;
  rows: number;
  columns: number;
  x: number;
  y: number;
}

export interface VenueSeat {
  id: string;
  row: string;
  number: string;
  section?: string;
  x: number;
  y: number;
  type?: 'regular' | 'vip' | 'accessible';
}

export interface Tariff {
  id: string;
  sessionId: string;
  name: string;
  price: number;
  color: string;
  description?: string;
  isActive: boolean;
  seatCount: number;
}

export interface Seat {
  id: string;
  sessionId: string;
  row: string;
  number: string;
  section?: string;
  status: 'AVAILABLE' | 'RESERVED' | 'OCCUPIED' | 'DISABLED' | 'HIDDEN';
  x: number;
  y: number;
  tariffId?: string;
  tariff?: {
    id: string;
    name: string;
    price: number;
    color: string;
  };
}

export interface Session {
  id: string;
  venueId: string;
  name: string;
  description?: string;
  startTime: string;
  endTime: string;
  status: SessionStatus;
  createdAt: string;
  updatedAt: string;
  venue: Venue;
  tariffs: Tariff[];
  seats: Seat[];
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

export interface SessionListItem {
  id: string;
  name: string;
  status: SessionStatus;
  startTime: string;
  endTime: string;
  venue: {
    id: string;
    name: string;
  };
  _count: {
    seats: number;
    bookings: number;
  };
}

export interface SessionQuery {
  status?: SessionStatus;
  venueId?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
  sortBy?: 'startTime' | 'createdAt' | 'name';
  sortOrder?: 'asc' | 'desc';
}

export interface CreateSessionInput {
  venueId: string;
  name: string;
  description?: string;
  startTime: string;
  endTime: string;
}

export interface UpdateSessionInput {
  name?: string;
  description?: string;
  startTime?: string;
  endTime?: string;
}

export interface CreateTariffInput {
  name: string;
  price: number;
  color: string;
  description?: string;
  isActive?: boolean;
}

export interface BulkAssignInput {
  assignments: Array<{
    tariffId: string;
    filter: {
      section?: string;
      rowRange?: { start: string; end: string };
      seatRange?: { start: number; end: number };
    };
  }>;
}

export interface AutoAssignInput {
  tariffIds: string[];
  strategy: 'equal_sections' | 'by_row' | 'by_distance_from_stage';
}

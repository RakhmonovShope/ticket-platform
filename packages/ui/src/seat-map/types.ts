/**
 * Types for the CanvasSeatMap component
 */

// ============================================================================
// SEAT TYPES
// ============================================================================

export type SeatStatus = 'AVAILABLE' | 'RESERVED' | 'OCCUPIED' | 'DISABLED' | 'HIDDEN';

export type SeatShape = 'RECTANGLE' | 'CIRCLE' | 'POLYGON';

export interface Tariff {
  id: string;
  name: string;
  price: number;
  color: string;
}

export interface Seat {
  id: string;
  row: string;
  number: string;
  section: string;
  x: number;
  y: number;
  width: number;
  height: number;
  shape: SeatShape;
  rotation: number;
  status: SeatStatus;
  tariff?: Tariff;
}

export interface Section {
  id: string;
  name: string;
  color: string;
}

export interface Stage {
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
}

export interface Aisle {
  id: string;
  points: Array<{ x: number; y: number }>;
}

// ============================================================================
// COMPONENT PROPS
// ============================================================================

export interface CanvasSeatMapProps {
  /** Canvas width in pixels (default: 800) */
  width?: number;
  /** Canvas height in pixels (default: 600) */
  height?: number;
  /** Array of seats to render */
  seats: Seat[];
  /** Currently selected seat IDs */
  selectedSeats: string[];
  /** Callback when a seat is clicked */
  onSeatClick: (seat: Seat) => void;
  /** Callback when hovering over a seat */
  onSeatHover?: (seat: Seat | null) => void;
  /** Disable all interactions (default: false) */
  readOnly?: boolean;
  /** Minimum zoom level (default: 0.5) */
  minZoom?: number;
  /** Maximum zoom level (default: 3) */
  maxZoom?: number;
  /** Show tooltip on hover (default: true) */
  showTooltip?: boolean;
  /** Optional stage to render */
  stage?: Stage;
  /** Optional aisles to render */
  aisles?: Aisle[];
  /** Custom class name */
  className?: string;
  /** Background color (default: #0f172a) */
  backgroundColor?: string;
}

// ============================================================================
// INTERNAL STATE TYPES
// ============================================================================

export interface Viewport {
  x: number;
  y: number;
  scale: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

// ============================================================================
// COLOR CONFIGURATION
// ============================================================================

export interface SeatColors {
  AVAILABLE: string;
  RESERVED: string;
  OCCUPIED: string;
  DISABLED: string;
  HIDDEN: string;
  selected: string;
  hover: string;
  border: string;
  text: string;
  stage: string;
  stageText: string;
  aisle: string;
}

export const DEFAULT_COLORS: SeatColors = {
  AVAILABLE: '#3b82f6',   // blue - fallback when no tariff color
  RESERVED: '#ef4444',    // red
  OCCUPIED: '#ef4444',    // red
  DISABLED: '#9ca3af',    // gray
  HIDDEN: 'transparent',
  selected: '#10b981',    // green
  hover: '#60a5fa',       // light blue
  border: '#ffffff',
  text: '#ffffff',
  stage: '#1e293b',
  stageText: '#e2e8f0',
  aisle: '#4b5563',       // gray-600
};

// ============================================================================
// TOOLTIP TYPES
// ============================================================================

export interface TooltipData {
  seat: Seat;
  x: number;
  y: number;
}

// ============================================================================
// SPATIAL INDEX TYPES (for performance optimization)
// ============================================================================

export interface SpatialCell {
  seats: Seat[];
}

export interface SpatialIndex {
  cells: Map<string, SpatialCell>;
  cellSize: number;
}

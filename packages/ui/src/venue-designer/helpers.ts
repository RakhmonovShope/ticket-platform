import { v4 as uuidv4 } from 'uuid';
import type {
  DesignerSeat,
  DesignerSection,
  DesignerAisle,
  DesignerStage,
  Point,
  Bounds,
  VenueSchema,
} from './types';
import {
  DEFAULT_SEAT_WIDTH,
  DEFAULT_SEAT_HEIGHT,
  DEFAULT_SECTION_COLORS,
} from './types';

// ============================================================================
// GRID SNAP
// ============================================================================

/**
 * Snap a value to the nearest grid point
 */
export function snapToGrid(value: number, gridSize: number, enabled: boolean = true): number {
  if (!enabled || gridSize <= 0) return value;
  return Math.round(value / gridSize) * gridSize;
}

/**
 * Snap a point to the grid
 */
export function snapPointToGrid(point: Point, gridSize: number, enabled: boolean = true): Point {
  return {
    x: snapToGrid(point.x, gridSize, enabled),
    y: snapToGrid(point.y, gridSize, enabled),
  };
}

// ============================================================================
// COLLISION DETECTION
// ============================================================================

/**
 * Check if two rectangles overlap
 */
export function checkRectOverlap(a: Bounds, b: Bounds, padding: number = 0): boolean {
  return !(
    a.x + a.width + padding <= b.x ||
    b.x + b.width + padding <= a.x ||
    a.y + a.height + padding <= b.y ||
    b.y + b.height + padding <= a.y
  );
}

/**
 * Check if a new seat would overlap with existing seats
 */
export function checkSeatOverlap(
  newSeat: { x: number; y: number; width: number; height: number },
  existingSeats: DesignerSeat[],
  excludeId?: string,
  padding: number = 2
): boolean {
  for (const seat of existingSeats) {
    if (excludeId && seat.id === excludeId) continue;
    if (checkRectOverlap(newSeat, seat, padding)) {
      return true;
    }
  }
  return false;
}

/**
 * Find seats within a selection box
 */
export function findSeatsInBounds(seats: DesignerSeat[], bounds: Bounds): DesignerSeat[] {
  return seats.filter((seat) => {
    const seatCenterX = seat.x + seat.width / 2;
    const seatCenterY = seat.y + seat.height / 2;
    return (
      seatCenterX >= bounds.x &&
      seatCenterX <= bounds.x + bounds.width &&
      seatCenterY >= bounds.y &&
      seatCenterY <= bounds.y + bounds.height
    );
  });
}

/**
 * Check if a point is inside a seat
 */
export function isPointInSeat(point: Point, seat: DesignerSeat): boolean {
  return (
    point.x >= seat.x &&
    point.x <= seat.x + seat.width &&
    point.y >= seat.y &&
    point.y <= seat.y + seat.height
  );
}

// ============================================================================
// AUTO-NUMBERING
// ============================================================================

/**
 * Get the next row letter (A -> B -> ... -> Z -> AA -> AB ...)
 */
export function getNextRow(currentRow: string): string {
  if (currentRow === '') return 'A';

  const chars = currentRow.toUpperCase().split('');
  let carry = true;

  for (let i = chars.length - 1; i >= 0 && carry; i--) {
    const code = chars[i].charCodeAt(0);
    if (code < 90) {
      // Z
      chars[i] = String.fromCharCode(code + 1);
      carry = false;
    } else {
      chars[i] = 'A';
    }
  }

  if (carry) {
    chars.unshift('A');
  }

  return chars.join('');
}

/**
 * Auto-generate seat row and number based on position
 */
export function autoNumberSeat(
  x: number,
  y: number,
  existingSeats: DesignerSeat[],
  currentRow: string,
  gridSize: number = 40
): { row: string; number: string } {
  // Calculate row based on Y position
  const rowIndex = Math.floor(y / gridSize);
  let row = 'A';
  for (let i = 0; i < rowIndex; i++) {
    row = getNextRow(row);
  }

  // Find the highest number in this row
  const seatsInRow = existingSeats.filter((s) => s.row === row);
  const maxNumber = seatsInRow.reduce((max, s) => {
    const num = parseInt(s.number, 10);
    return isNaN(num) ? max : Math.max(max, num);
  }, 0);

  return {
    row,
    number: String(maxNumber + 1),
  };
}

/**
 * Auto-number a batch of seats (for drag placement)
 */
export function autoNumberSeatBatch(
  seats: Array<{ x: number; y: number }>,
  existingSeats: DesignerSeat[],
  startRow: string,
  startNumber: number
): Array<{ row: string; number: string }> {
  // Sort by Y first, then by X
  const sorted = [...seats].sort((a, b) => {
    if (Math.abs(a.y - b.y) < 10) {
      return a.x - b.x;
    }
    return a.y - b.y;
  });

  const result: Array<{ row: string; number: string }> = [];
  let currentRow = startRow;
  let currentNumber = startNumber;
  let lastY = sorted[0]?.y ?? 0;

  for (const seat of sorted) {
    // If Y changed significantly, move to next row
    if (Math.abs(seat.y - lastY) > 20) {
      currentRow = getNextRow(currentRow);
      currentNumber = 1;
      lastY = seat.y;
    }

    result.push({
      row: currentRow,
      number: String(currentNumber),
    });

    currentNumber++;
  }

  return result;
}

// ============================================================================
// SEAT CREATION
// ============================================================================

/**
 * Create a new seat with default values
 */
export function createSeat(
  x: number,
  y: number,
  options: Partial<DesignerSeat> = {}
): DesignerSeat {
  return {
    id: uuidv4(),
    row: 'A',
    number: '1',
    section: 'default',
    x,
    y,
    width: DEFAULT_SEAT_WIDTH,
    height: DEFAULT_SEAT_HEIGHT,
    shape: 'RECTANGLE',
    rotation: 0,
    ...options,
  };
}

/**
 * Create multiple seats in a row
 */
export function createSeatRow(
  startX: number,
  y: number,
  count: number,
  row: string,
  startNumber: number,
  spacing: number = 5,
  options: Partial<DesignerSeat> = {}
): DesignerSeat[] {
  const seats: DesignerSeat[] = [];
  const width = options.width ?? DEFAULT_SEAT_WIDTH;

  for (let i = 0; i < count; i++) {
    seats.push(
      createSeat(startX + i * (width + spacing), y, {
        row,
        number: String(startNumber + i),
        ...options,
      })
    );
  }

  return seats;
}

/**
 * Duplicate seats with offset
 */
export function duplicateSeats(
  seats: DesignerSeat[],
  offsetX: number = 20,
  offsetY: number = 20
): DesignerSeat[] {
  return seats.map((seat) => ({
    ...seat,
    id: uuidv4(),
    x: seat.x + offsetX,
    y: seat.y + offsetY,
  }));
}

// ============================================================================
// SECTION HELPERS
// ============================================================================

/**
 * Create a new section
 */
export function createSection(
  name: string,
  seatIds: string[],
  existingSections: DesignerSection[]
): DesignerSection {
  // Pick a color not already used
  const usedColors = new Set(existingSections.map((s) => s.color));
  const color = DEFAULT_SECTION_COLORS.find((c) => !usedColors.has(c)) || DEFAULT_SECTION_COLORS[0];

  return {
    id: uuidv4(),
    name,
    color,
    seatIds,
  };
}

/**
 * Get section for a seat
 */
export function getSectionForSeat(
  seatId: string,
  sections: DesignerSection[]
): DesignerSection | null {
  return sections.find((s) => s.seatIds.includes(seatId)) || null;
}

// ============================================================================
// STAGE HELPERS
// ============================================================================

/**
 * Create a default stage
 */
export function createStage(
  canvasWidth: number,
  canvasHeight: number,
  options: Partial<DesignerStage> = {}
): DesignerStage {
  const width = options.width ?? canvasWidth * 0.7;
  const height = options.height ?? 80;

  return {
    x: options.x ?? (canvasWidth - width) / 2,
    y: options.y ?? 20,
    width,
    height,
    label: options.label ?? 'STAGE',
  };
}

// ============================================================================
// AISLE HELPERS
// ============================================================================

/**
 * Create a new aisle from points
 */
export function createAisle(points: Point[]): DesignerAisle {
  return {
    id: uuidv4(),
    points: points.map((p) => ({ x: p.x, y: p.y })),
  };
}

/**
 * Simplify aisle points (remove redundant points)
 */
export function simplifyAislePoints(points: Point[], tolerance: number = 5): Point[] {
  if (points.length <= 2) return points;

  const result: Point[] = [points[0]];

  for (let i = 1; i < points.length - 1; i++) {
    const prev = result[result.length - 1];
    const curr = points[i];
    const next = points[i + 1];

    // Check if current point significantly changes direction
    const dx1 = curr.x - prev.x;
    const dy1 = curr.y - prev.y;
    const dx2 = next.x - curr.x;
    const dy2 = next.y - curr.y;

    const cross = Math.abs(dx1 * dy2 - dy1 * dx2);
    if (cross > tolerance * tolerance) {
      result.push(curr);
    }
  }

  result.push(points[points.length - 1]);
  return result;
}

// ============================================================================
// BOUNDS CALCULATION
// ============================================================================

/**
 * Calculate bounding box for seats
 */
export function calculateSeatsBounds(seats: DesignerSeat[]): Bounds | null {
  if (seats.length === 0) return null;

  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;

  for (const seat of seats) {
    minX = Math.min(minX, seat.x);
    minY = Math.min(minY, seat.y);
    maxX = Math.max(maxX, seat.x + seat.width);
    maxY = Math.max(maxY, seat.y + seat.height);
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

/**
 * Normalize selection box (handle negative dimensions)
 */
export function normalizeSelectionBox(
  startX: number,
  startY: number,
  endX: number,
  endY: number
): Bounds {
  return {
    x: Math.min(startX, endX),
    y: Math.min(startY, endY),
    width: Math.abs(endX - startX),
    height: Math.abs(endY - startY),
  };
}

// ============================================================================
// IMPORT/EXPORT
// ============================================================================

/**
 * Export designer state to VenueSchema
 */
export function exportToSchema(
  seats: DesignerSeat[],
  sections: DesignerSection[],
  stage: DesignerStage | null,
  aisles: DesignerAisle[],
  canvasWidth: number,
  canvasHeight: number
): VenueSchema {
  return {
    width: canvasWidth,
    height: canvasHeight,
    stage: stage ?? undefined,
    sections,
    seats,
    aisles,
  };
}

/**
 * Import schema to designer state
 */
export function importFromSchema(schema: VenueSchema): {
  seats: DesignerSeat[];
  sections: DesignerSection[];
  stage: DesignerStage | null;
  aisles: DesignerAisle[];
} {
  return {
    seats: schema.seats || [],
    sections: schema.sections || [],
    stage: schema.stage || null,
    aisles: schema.aisles || [],
  };
}

/**
 * Validate schema structure
 */
export function validateSchema(schema: unknown): schema is VenueSchema {
  if (!schema || typeof schema !== 'object') return false;

  const s = schema as Record<string, unknown>;
  if (typeof s.width !== 'number' || typeof s.height !== 'number') return false;
  if (!Array.isArray(s.seats) || !Array.isArray(s.sections) || !Array.isArray(s.aisles)) {
    return false;
  }

  return true;
}

// ============================================================================
// LOCAL STORAGE
// ============================================================================

/**
 * Save schema to localStorage
 */
export function saveToLocalStorage(schema: VenueSchema, key: string): void {
  try {
    localStorage.setItem(key, JSON.stringify(schema));
  } catch (error) {
    console.error('Failed to save to localStorage:', error);
  }
}

/**
 * Load schema from localStorage
 */
export function loadFromLocalStorage(key: string): VenueSchema | null {
  try {
    const data = localStorage.getItem(key);
    if (!data) return null;

    const schema = JSON.parse(data);
    if (!validateSchema(schema)) return null;

    return schema;
  } catch (error) {
    console.error('Failed to load from localStorage:', error);
    return null;
  }
}

// ============================================================================
// COORDINATE TRANSFORMS
// ============================================================================

/**
 * Convert screen coordinates to canvas coordinates
 */
export function screenToCanvas(
  screenX: number,
  screenY: number,
  panX: number,
  panY: number,
  zoom: number,
  canvasRect: DOMRect
): Point {
  const x = (screenX - canvasRect.left - panX) / zoom;
  const y = (screenY - canvasRect.top - panY) / zoom;
  return { x, y };
}

/**
 * Convert canvas coordinates to screen coordinates
 */
export function canvasToScreen(
  canvasX: number,
  canvasY: number,
  panX: number,
  panY: number,
  zoom: number
): Point {
  return {
    x: canvasX * zoom + panX,
    y: canvasY * zoom + panY,
  };
}

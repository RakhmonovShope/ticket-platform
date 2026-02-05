import { describe, it, expect } from 'vitest';
import type { Seat, Viewport, Point, Bounds, SpatialIndex } from './types';

// ============================================================================
// COORDINATE CALCULATIONS (extracted for testing)
// ============================================================================

/**
 * Convert screen coordinates to world coordinates
 */
function screenToWorld(
  screenX: number,
  screenY: number,
  viewport: Viewport
): Point {
  return {
    x: (screenX - viewport.x) / viewport.scale,
    y: (screenY - viewport.y) / viewport.scale,
  };
}

/**
 * Convert world coordinates to screen coordinates
 */
function worldToScreen(
  worldX: number,
  worldY: number,
  viewport: Viewport
): Point {
  return {
    x: worldX * viewport.scale + viewport.x,
    y: worldY * viewport.scale + viewport.y,
  };
}

/**
 * Check if a point is inside a rectangle
 */
function pointInRectangle(
  pointX: number,
  pointY: number,
  rectX: number,
  rectY: number,
  rectWidth: number,
  rectHeight: number
): boolean {
  return (
    pointX >= rectX &&
    pointX <= rectX + rectWidth &&
    pointY >= rectY &&
    pointY <= rectY + rectHeight
  );
}

/**
 * Check if a point is inside a circle
 */
function pointInCircle(
  pointX: number,
  pointY: number,
  centerX: number,
  centerY: number,
  radius: number
): boolean {
  const dx = pointX - centerX;
  const dy = pointY - centerY;
  return dx * dx + dy * dy <= radius * radius;
}

/**
 * Check if a point is inside a rotated rectangle
 */
function pointInRotatedRectangle(
  pointX: number,
  pointY: number,
  rectCenterX: number,
  rectCenterY: number,
  rectWidth: number,
  rectHeight: number,
  rotationDegrees: number
): boolean {
  // Translate point to be relative to rectangle center
  const translatedX = pointX - rectCenterX;
  const translatedY = pointY - rectCenterY;

  // Rotate point in opposite direction
  const radians = (-rotationDegrees * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);

  const rotatedX = translatedX * cos - translatedY * sin;
  const rotatedY = translatedX * sin + translatedY * cos;

  // Check if rotated point is inside axis-aligned rectangle
  return (
    Math.abs(rotatedX) <= rectWidth / 2 &&
    Math.abs(rotatedY) <= rectHeight / 2
  );
}

/**
 * Check if a point is inside a seat (handles shape and rotation)
 */
function pointInSeat(point: Point, seat: Seat): boolean {
  const centerX = seat.x + seat.width / 2;
  const centerY = seat.y + seat.height / 2;

  if (seat.shape === 'CIRCLE') {
    const radius = Math.min(seat.width, seat.height) / 2;
    return pointInCircle(point.x, point.y, centerX, centerY, radius);
  }

  if (seat.rotation !== 0) {
    return pointInRotatedRectangle(
      point.x,
      point.y,
      centerX,
      centerY,
      seat.width,
      seat.height,
      seat.rotation
    );
  }

  return pointInRectangle(
    point.x,
    point.y,
    seat.x,
    seat.y,
    seat.width,
    seat.height
  );
}

/**
 * Calculate the bounding box of all seats
 */
function calculateBounds(seats: Seat[]): Bounds {
  if (seats.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const seat of seats) {
    minX = Math.min(minX, seat.x);
    minY = Math.min(minY, seat.y);
    maxX = Math.max(maxX, seat.x + seat.width);
    maxY = Math.max(maxY, seat.y + seat.height);
  }

  return { minX, minY, maxX, maxY };
}

/**
 * Calculate zoom to fit bounds in viewport
 */
function calculateFitZoom(
  bounds: Bounds,
  canvasWidth: number,
  canvasHeight: number,
  padding: number = 50,
  minZoom: number = 0.5,
  maxZoom: number = 3
): number {
  const boundsWidth = bounds.maxX - bounds.minX;
  const boundsHeight = bounds.maxY - bounds.minY;

  if (boundsWidth === 0 || boundsHeight === 0) {
    return 1;
  }

  const availableWidth = canvasWidth - padding * 2;
  const availableHeight = canvasHeight - padding * 2;

  const scaleX = availableWidth / boundsWidth;
  const scaleY = availableHeight / boundsHeight;

  const scale = Math.min(scaleX, scaleY);
  return Math.max(minZoom, Math.min(maxZoom, scale));
}

/**
 * Get spatial index cell key for a point
 */
function getCellKey(x: number, y: number, cellSize: number): string {
  const cellX = Math.floor(x / cellSize);
  const cellY = Math.floor(y / cellSize);
  return `${cellX}:${cellY}`;
}

/**
 * Build spatial index for seats
 */
function buildSpatialIndex(seats: Seat[], cellSize: number = 100): SpatialIndex {
  const cells = new Map<string, { seats: Seat[] }>();

  for (const seat of seats) {
    // Calculate which cells this seat overlaps
    const startCellX = Math.floor(seat.x / cellSize);
    const startCellY = Math.floor(seat.y / cellSize);
    const endCellX = Math.floor((seat.x + seat.width) / cellSize);
    const endCellY = Math.floor((seat.y + seat.height) / cellSize);

    for (let cx = startCellX; cx <= endCellX; cx++) {
      for (let cy = startCellY; cy <= endCellY; cy++) {
        const key = `${cx}:${cy}`;
        if (!cells.has(key)) {
          cells.set(key, { seats: [] });
        }
        cells.get(key)!.seats.push(seat);
      }
    }
  }

  return { cells, cellSize };
}

// ============================================================================
// TESTS
// ============================================================================

describe('Coordinate Transformations', () => {
  describe('screenToWorld', () => {
    it('should convert screen coordinates at scale 1 with no offset', () => {
      const viewport: Viewport = { x: 0, y: 0, scale: 1 };
      const result = screenToWorld(100, 200, viewport);
      expect(result.x).toBe(100);
      expect(result.y).toBe(200);
    });

    it('should account for viewport translation', () => {
      const viewport: Viewport = { x: 50, y: 100, scale: 1 };
      const result = screenToWorld(150, 200, viewport);
      expect(result.x).toBe(100);
      expect(result.y).toBe(100);
    });

    it('should account for viewport scale', () => {
      const viewport: Viewport = { x: 0, y: 0, scale: 2 };
      const result = screenToWorld(200, 400, viewport);
      expect(result.x).toBe(100);
      expect(result.y).toBe(200);
    });

    it('should handle combined translation and scale', () => {
      const viewport: Viewport = { x: 100, y: 50, scale: 0.5 };
      const result = screenToWorld(150, 100, viewport);
      expect(result.x).toBe(100);
      expect(result.y).toBe(100);
    });

    it('should handle negative offsets', () => {
      const viewport: Viewport = { x: -100, y: -50, scale: 1 };
      const result = screenToWorld(0, 0, viewport);
      expect(result.x).toBe(100);
      expect(result.y).toBe(50);
    });
  });

  describe('worldToScreen', () => {
    it('should convert world coordinates at scale 1 with no offset', () => {
      const viewport: Viewport = { x: 0, y: 0, scale: 1 };
      const result = worldToScreen(100, 200, viewport);
      expect(result.x).toBe(100);
      expect(result.y).toBe(200);
    });

    it('should account for viewport translation', () => {
      const viewport: Viewport = { x: 50, y: 100, scale: 1 };
      const result = worldToScreen(100, 100, viewport);
      expect(result.x).toBe(150);
      expect(result.y).toBe(200);
    });

    it('should account for viewport scale', () => {
      const viewport: Viewport = { x: 0, y: 0, scale: 2 };
      const result = worldToScreen(100, 200, viewport);
      expect(result.x).toBe(200);
      expect(result.y).toBe(400);
    });

    it('should be inverse of screenToWorld', () => {
      const viewport: Viewport = { x: 150, y: -75, scale: 1.5 };
      const originalScreen = { x: 300, y: 225 };
      const world = screenToWorld(originalScreen.x, originalScreen.y, viewport);
      const backToScreen = worldToScreen(world.x, world.y, viewport);
      expect(backToScreen.x).toBeCloseTo(originalScreen.x);
      expect(backToScreen.y).toBeCloseTo(originalScreen.y);
    });
  });
});

describe('Hit Detection', () => {
  describe('pointInRectangle', () => {
    it('should return true for point inside rectangle', () => {
      expect(pointInRectangle(50, 50, 0, 0, 100, 100)).toBe(true);
    });

    it('should return true for point on edge', () => {
      expect(pointInRectangle(0, 50, 0, 0, 100, 100)).toBe(true);
      expect(pointInRectangle(100, 50, 0, 0, 100, 100)).toBe(true);
    });

    it('should return false for point outside rectangle', () => {
      expect(pointInRectangle(-1, 50, 0, 0, 100, 100)).toBe(false);
      expect(pointInRectangle(101, 50, 0, 0, 100, 100)).toBe(false);
      expect(pointInRectangle(50, -1, 0, 0, 100, 100)).toBe(false);
      expect(pointInRectangle(50, 101, 0, 0, 100, 100)).toBe(false);
    });
  });

  describe('pointInCircle', () => {
    it('should return true for point inside circle', () => {
      expect(pointInCircle(50, 50, 50, 50, 25)).toBe(true);
    });

    it('should return true for point on edge', () => {
      expect(pointInCircle(75, 50, 50, 50, 25)).toBe(true);
    });

    it('should return false for point outside circle', () => {
      expect(pointInCircle(80, 80, 50, 50, 25)).toBe(false);
    });

    it('should handle edge case of point at center', () => {
      expect(pointInCircle(50, 50, 50, 50, 1)).toBe(true);
    });
  });

  describe('pointInRotatedRectangle', () => {
    it('should work for 0 degree rotation', () => {
      expect(
        pointInRotatedRectangle(50, 50, 50, 50, 40, 40, 0)
      ).toBe(true);
      expect(
        pointInRotatedRectangle(100, 50, 50, 50, 40, 40, 0)
      ).toBe(false);
    });

    it('should handle 90 degree rotation', () => {
      // Point that would be inside horizontal rect but outside vertical
      const centerX = 50;
      const centerY = 50;
      const width = 60;
      const height = 20;

      // With no rotation, point at (70, 50) is inside
      expect(
        pointInRotatedRectangle(70, 50, centerX, centerY, width, height, 0)
      ).toBe(true);

      // With 90 degree rotation, width and height swap, so (70, 50) is outside
      expect(
        pointInRotatedRectangle(70, 50, centerX, centerY, width, height, 90)
      ).toBe(false);

      // But point at (50, 70) should be inside after 90 degree rotation
      expect(
        pointInRotatedRectangle(50, 70, centerX, centerY, width, height, 90)
      ).toBe(true);
    });

    it('should handle 45 degree rotation', () => {
      const centerX = 50;
      const centerY = 50;
      const size = 40;

      // Corner of unrotated square would be at (30, 30) to (70, 70)
      // After 45 degree rotation, the diamond extends further along axes

      // Point at corner of original square
      expect(
        pointInRotatedRectangle(70, 70, centerX, centerY, size, size, 45)
      ).toBe(false);

      // Point along diagonal should be inside
      expect(
        pointInRotatedRectangle(50, 50, centerX, centerY, size, size, 45)
      ).toBe(true);
    });
  });

  describe('pointInSeat', () => {
    const createSeat = (
      x: number,
      y: number,
      shape: 'RECTANGLE' | 'CIRCLE' = 'RECTANGLE',
      rotation: number = 0
    ): Seat => ({
      id: 'test',
      row: 'A',
      number: '1',
      section: 'Test',
      x,
      y,
      width: 30,
      height: 30,
      shape,
      rotation,
      status: 'AVAILABLE',
    });

    it('should detect point inside rectangular seat', () => {
      const seat = createSeat(0, 0, 'RECTANGLE');
      expect(pointInSeat({ x: 15, y: 15 }, seat)).toBe(true);
      expect(pointInSeat({ x: 35, y: 15 }, seat)).toBe(false);
    });

    it('should detect point inside circular seat', () => {
      const seat = createSeat(0, 0, 'CIRCLE');
      expect(pointInSeat({ x: 15, y: 15 }, seat)).toBe(true);
      expect(pointInSeat({ x: 2, y: 2 }, seat)).toBe(false); // Corner
    });

    it('should handle rotated seat', () => {
      const seat = createSeat(0, 0, 'RECTANGLE', 45);
      // Center should always be inside
      expect(pointInSeat({ x: 15, y: 15 }, seat)).toBe(true);
    });
  });
});

describe('Bounds Calculation', () => {
  const createSeat = (x: number, y: number, width = 30, height = 30): Seat => ({
    id: `seat-${x}-${y}`,
    row: 'A',
    number: '1',
    section: 'Test',
    x,
    y,
    width,
    height,
    shape: 'RECTANGLE',
    rotation: 0,
    status: 'AVAILABLE',
  });

  it('should return zero bounds for empty array', () => {
    const bounds = calculateBounds([]);
    expect(bounds).toEqual({ minX: 0, minY: 0, maxX: 0, maxY: 0 });
  });

  it('should calculate bounds for single seat', () => {
    const seats = [createSeat(100, 200)];
    const bounds = calculateBounds(seats);
    expect(bounds.minX).toBe(100);
    expect(bounds.minY).toBe(200);
    expect(bounds.maxX).toBe(130);
    expect(bounds.maxY).toBe(230);
  });

  it('should calculate bounds for multiple seats', () => {
    const seats = [
      createSeat(0, 0),
      createSeat(100, 50),
      createSeat(50, 100),
    ];
    const bounds = calculateBounds(seats);
    expect(bounds.minX).toBe(0);
    expect(bounds.minY).toBe(0);
    expect(bounds.maxX).toBe(130);
    expect(bounds.maxY).toBe(130);
  });

  it('should handle seats with different sizes', () => {
    const seats = [
      createSeat(0, 0, 20, 20),
      createSeat(100, 100, 50, 50),
    ];
    const bounds = calculateBounds(seats);
    expect(bounds.minX).toBe(0);
    expect(bounds.minY).toBe(0);
    expect(bounds.maxX).toBe(150);
    expect(bounds.maxY).toBe(150);
  });
});

describe('Fit to View', () => {
  it('should calculate zoom to fit bounds in canvas', () => {
    const bounds: Bounds = { minX: 0, minY: 0, maxX: 400, maxY: 300 };
    const zoom = calculateFitZoom(bounds, 800, 600, 0);
    expect(zoom).toBe(2);
  });

  it('should account for padding', () => {
    const bounds: Bounds = { minX: 0, minY: 0, maxX: 400, maxY: 300 };
    const zoom = calculateFitZoom(bounds, 800, 600, 50);
    // Available: 700x500, bounds: 400x300
    // scaleX = 700/400 = 1.75, scaleY = 500/300 = 1.667
    expect(zoom).toBeCloseTo(1.667, 2);
  });

  it('should respect minZoom', () => {
    const bounds: Bounds = { minX: 0, minY: 0, maxX: 4000, maxY: 3000 };
    const zoom = calculateFitZoom(bounds, 800, 600, 0, 0.5);
    expect(zoom).toBe(0.5);
  });

  it('should respect maxZoom', () => {
    const bounds: Bounds = { minX: 0, minY: 0, maxX: 100, maxY: 100 };
    const zoom = calculateFitZoom(bounds, 800, 600, 0, 0.5, 3);
    expect(zoom).toBe(3);
  });

  it('should return 1 for zero-size bounds', () => {
    const bounds: Bounds = { minX: 100, minY: 100, maxX: 100, maxY: 100 };
    const zoom = calculateFitZoom(bounds, 800, 600);
    expect(zoom).toBe(1);
  });
});

describe('Spatial Indexing', () => {
  const createSeat = (x: number, y: number): Seat => ({
    id: `seat-${x}-${y}`,
    row: 'A',
    number: '1',
    section: 'Test',
    x,
    y,
    width: 30,
    height: 30,
    shape: 'RECTANGLE',
    rotation: 0,
    status: 'AVAILABLE',
  });

  it('should get correct cell key', () => {
    expect(getCellKey(0, 0, 100)).toBe('0:0');
    expect(getCellKey(99, 99, 100)).toBe('0:0');
    expect(getCellKey(100, 0, 100)).toBe('1:0');
    expect(getCellKey(150, 250, 100)).toBe('1:2');
    expect(getCellKey(-50, -50, 100)).toBe('-1:-1');
  });

  it('should build spatial index with seats in correct cells', () => {
    const seats = [
      createSeat(0, 0),     // Cell 0:0
      createSeat(50, 50),   // Cell 0:0
      createSeat(150, 150), // Cell 1:1
    ];

    const index = buildSpatialIndex(seats, 100);

    expect(index.cells.has('0:0')).toBe(true);
    expect(index.cells.has('1:1')).toBe(true);
    expect(index.cells.get('0:0')!.seats.length).toBe(2);
    expect(index.cells.get('1:1')!.seats.length).toBe(1);
  });

  it('should place seat in multiple cells when it spans boundaries', () => {
    const seats = [createSeat(90, 90)]; // 90-120 on both axes, spans 0:0, 0:1, 1:0, 1:1

    const index = buildSpatialIndex(seats, 100);

    expect(index.cells.has('0:0')).toBe(true);
    expect(index.cells.has('0:1')).toBe(true);
    expect(index.cells.has('1:0')).toBe(true);
    expect(index.cells.has('1:1')).toBe(true);
  });

  it('should handle empty seat array', () => {
    const index = buildSpatialIndex([], 100);
    expect(index.cells.size).toBe(0);
    expect(index.cellSize).toBe(100);
  });
});

describe('Zoom Calculations', () => {
  it('should calculate new viewport position for zoom centered on mouse', () => {
    // This tests the zoom centering logic
    const oldViewport: Viewport = { x: 0, y: 0, scale: 1 };
    const mouseX = 400; // Center of 800px canvas
    const mouseY = 300; // Center of 600px canvas
    const newScale = 2;

    // The formula: newX = mouseX - (mouseX - oldX) * (newScale / oldScale)
    const newX = mouseX - (mouseX - oldViewport.x) * (newScale / oldViewport.scale);
    const newY = mouseY - (mouseY - oldViewport.y) * (newScale / oldViewport.scale);

    // At scale 2, zooming into center should shift viewport by half canvas size
    expect(newX).toBe(-400);
    expect(newY).toBe(-300);

    // Verify the point under cursor remains at same screen position
    // worldX at mouse before zoom: (400 - 0) / 1 = 400
    // worldX at mouse after zoom: (400 - (-400)) / 2 = 400
    const worldBefore = (mouseX - oldViewport.x) / oldViewport.scale;
    const worldAfter = (mouseX - newX) / newScale;
    expect(worldBefore).toBe(worldAfter);
  });

  it('should handle zoom out from center', () => {
    const oldViewport: Viewport = { x: -400, y: -300, scale: 2 };
    const mouseX = 400;
    const mouseY = 300;
    const newScale = 1;

    const newX = mouseX - (mouseX - oldViewport.x) * (newScale / oldViewport.scale);
    const newY = mouseY - (mouseY - oldViewport.y) * (newScale / oldViewport.scale);

    expect(newX).toBe(0);
    expect(newY).toBe(0);
  });

  it('should handle zoom at corner of canvas', () => {
    const oldViewport: Viewport = { x: 0, y: 0, scale: 1 };
    const mouseX = 0;
    const mouseY = 0;
    const newScale = 2;

    const newX = mouseX - (mouseX - oldViewport.x) * (newScale / oldViewport.scale);
    const newY = mouseY - (mouseY - oldViewport.y) * (newScale / oldViewport.scale);

    // Zooming at origin should keep origin at (0,0) screen position
    expect(newX).toBe(0);
    expect(newY).toBe(0);
  });
});

'use client';

import { useRef, useEffect, useCallback, useMemo } from 'react';
import type { Seat, Stage, Aisle, Viewport, Point, SpatialIndex, Bounds } from './types';
import { DEFAULT_COLORS } from './types';

interface UseCanvasOptions {
  seats: Seat[];
  selectedSeats: Set<string>;
  hoveredSeatId: string | null;
  viewport: Viewport;
  stage?: Stage;
  aisles?: Aisle[];
  backgroundColor: string;
  canvasSize: { width: number; height: number };
}

interface UseCanvasReturn {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  render: () => void;
  findSeatAtPoint: (screenX: number, screenY: number) => Seat | null;
  screenToWorld: (screenX: number, screenY: number) => Point;
  worldToScreen: (worldX: number, worldY: number) => Point;
  calculateBounds: () => Bounds;
}

// Minimum zoom level to show seat numbers
const MIN_ZOOM_FOR_NUMBERS = 0.8;

/**
 * Custom hook for canvas rendering and hit detection
 */
export function useCanvas({
  seats,
  selectedSeats,
  hoveredSeatId,
  viewport,
  stage,
  aisles,
  backgroundColor,
  canvasSize,
}: UseCanvasOptions): UseCanvasReturn {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // =========================================================================
  // SPATIAL INDEX FOR PERFORMANCE (>1000 seats)
  // =========================================================================

  const spatialIndex = useMemo<SpatialIndex | null>(() => {
    if (seats.length < 1000) return null;

    const cellSize = 100; // pixels
    const cells = new Map<string, { seats: Seat[] }>();

    for (const seat of seats) {
      if (seat.status === 'HIDDEN') continue;

      // Get all cells this seat overlaps
      const startCellX = Math.floor(seat.x / cellSize);
      const startCellY = Math.floor(seat.y / cellSize);
      const endCellX = Math.floor((seat.x + seat.width) / cellSize);
      const endCellY = Math.floor((seat.y + seat.height) / cellSize);

      for (let cx = startCellX; cx <= endCellX; cx++) {
        for (let cy = startCellY; cy <= endCellY; cy++) {
          const key = `${cx},${cy}`;
          if (!cells.has(key)) {
            cells.set(key, { seats: [] });
          }
          cells.get(key)!.seats.push(seat);
        }
      }
    }

    return { cells, cellSize };
  }, [seats]);

  // =========================================================================
  // COORDINATE TRANSFORMATIONS
  // =========================================================================

  const screenToWorld = useCallback(
    (screenX: number, screenY: number): Point => {
      return {
        x: (screenX - viewport.x) / viewport.scale,
        y: (screenY - viewport.y) / viewport.scale,
      };
    },
    [viewport]
  );

  const worldToScreen = useCallback(
    (worldX: number, worldY: number): Point => {
      return {
        x: worldX * viewport.scale + viewport.x,
        y: worldY * viewport.scale + viewport.y,
      };
    },
    [viewport]
  );

  // =========================================================================
  // HIT DETECTION
  // =========================================================================

  const findSeatAtPoint = useCallback(
    (screenX: number, screenY: number): Seat | null => {
      const world = screenToWorld(screenX, screenY);

      // Use spatial index if available
      if (spatialIndex) {
        const cellX = Math.floor(world.x / spatialIndex.cellSize);
        const cellY = Math.floor(world.y / spatialIndex.cellSize);
        const key = `${cellX},${cellY}`;
        const cell = spatialIndex.cells.get(key);

        if (cell) {
          // Check seats in this cell (in reverse for top-most first)
          for (let i = cell.seats.length - 1; i >= 0; i--) {
            const seat = cell.seats[i];
            if (pointInSeat(world.x, world.y, seat)) {
              return seat;
            }
          }
        }
        return null;
      }

      // Linear search for smaller seat counts
      for (let i = seats.length - 1; i >= 0; i--) {
        const seat = seats[i];
        if (seat.status === 'HIDDEN') continue;
        if (pointInSeat(world.x, world.y, seat)) {
          return seat;
        }
      }

      return null;
    },
    [seats, spatialIndex, screenToWorld]
  );

  // =========================================================================
  // BOUNDS CALCULATION
  // =========================================================================

  const calculateBounds = useCallback((): Bounds => {
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;

    for (const seat of seats) {
      if (seat.status === 'HIDDEN') continue;
      minX = Math.min(minX, seat.x);
      minY = Math.min(minY, seat.y);
      maxX = Math.max(maxX, seat.x + seat.width);
      maxY = Math.max(maxY, seat.y + seat.height);
    }

    if (stage) {
      minX = Math.min(minX, stage.x);
      minY = Math.min(minY, stage.y);
      maxX = Math.max(maxX, stage.x + stage.width);
      maxY = Math.max(maxY, stage.y + stage.height);
    }

    return { minX, minY, maxX, maxY };
  }, [seats, stage]);

  // =========================================================================
  // RENDERING
  // =========================================================================

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;

    // Clear canvas
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Save context and apply viewport transform
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.translate(viewport.x, viewport.y);
    ctx.scale(viewport.scale, viewport.scale);

    // Draw aisles (gray lines)
    if (aisles && aisles.length > 0) {
      drawAisles(ctx, aisles, viewport.scale);
    }

    // Draw stage
    if (stage) {
      drawStage(ctx, stage, viewport.scale);
    }

    // Draw seats
    const showNumbers = viewport.scale >= MIN_ZOOM_FOR_NUMBERS;

    for (const seat of seats) {
      if (seat.status === 'HIDDEN') continue;

      const isSelected = selectedSeats.has(seat.id);
      const isHovered = hoveredSeatId === seat.id;

      drawSeat(ctx, seat, isSelected, isHovered, viewport.scale, showNumbers);
    }

    ctx.restore();

    // Draw zoom indicator
    drawZoomIndicator(ctx, viewport.scale, canvasSize);
  }, [
    viewport,
    seats,
    selectedSeats,
    hoveredSeatId,
    stage,
    aisles,
    backgroundColor,
    canvasSize,
  ]);

  // =========================================================================
  // SETUP CANVAS
  // =========================================================================

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvasSize.width * dpr;
    canvas.height = canvasSize.height * dpr;
    canvas.style.width = `${canvasSize.width}px`;
    canvas.style.height = `${canvasSize.height}px`;
  }, [canvasSize]);

  return {
    canvasRef,
    render,
    findSeatAtPoint,
    screenToWorld,
    worldToScreen,
    calculateBounds,
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function pointInSeat(x: number, y: number, seat: Seat): boolean {
  if (seat.shape === 'CIRCLE') {
    const centerX = seat.x + seat.width / 2;
    const centerY = seat.y + seat.height / 2;
    const radius = Math.min(seat.width, seat.height) / 2;
    const dx = x - centerX;
    const dy = y - centerY;
    return dx * dx + dy * dy <= radius * radius;
  }

  // RECTANGLE or POLYGON
  return (
    x >= seat.x &&
    x <= seat.x + seat.width &&
    y >= seat.y &&
    y <= seat.y + seat.height
  );
}

function drawAisles(
  ctx: CanvasRenderingContext2D,
  aisles: Aisle[],
  scale: number
) {
  ctx.strokeStyle = DEFAULT_COLORS.aisle;
  ctx.lineWidth = 3 / scale;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (const aisle of aisles) {
    if (aisle.points.length < 2) continue;

    ctx.beginPath();
    ctx.moveTo(aisle.points[0].x, aisle.points[0].y);

    for (let i = 1; i < aisle.points.length; i++) {
      ctx.lineTo(aisle.points[i].x, aisle.points[i].y);
    }

    ctx.stroke();
  }
}

function drawStage(ctx: CanvasRenderingContext2D, stage: Stage, scale: number) {
  // Stage background
  ctx.fillStyle = DEFAULT_COLORS.stage;
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 2 / scale;

  ctx.beginPath();
  ctx.roundRect(stage.x, stage.y, stage.width, stage.height, 8);
  ctx.fill();
  ctx.stroke();

  // Stage label
  ctx.fillStyle = DEFAULT_COLORS.stageText;
  ctx.font = `bold ${Math.max(14, 16 / scale)}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(
    stage.label || 'STAGE',
    stage.x + stage.width / 2,
    stage.y + stage.height / 2
  );
}

function drawSeat(
  ctx: CanvasRenderingContext2D,
  seat: Seat,
  isSelected: boolean,
  isHovered: boolean,
  scale: number,
  showNumbers: boolean
) {
  const { x, y, width, height, shape, rotation, status, tariff } = seat;

  // Determine fill color (priority: selected > hover > status-based)
  let fillColor: string;

  if (isSelected) {
    fillColor = DEFAULT_COLORS.selected; // Green for selected
  } else if (isHovered && status === 'AVAILABLE') {
    fillColor = DEFAULT_COLORS.hover;
  } else if (status === 'RESERVED' || status === 'OCCUPIED') {
    fillColor = DEFAULT_COLORS.RESERVED; // Red for reserved/occupied
  } else if (status === 'DISABLED') {
    fillColor = DEFAULT_COLORS.DISABLED;
  } else if (status === 'AVAILABLE' && tariff?.color) {
    fillColor = tariff.color; // Use tariff color for available seats
  } else {
    fillColor = DEFAULT_COLORS.AVAILABLE;
  }

  ctx.save();

  // Apply rotation if needed
  if (rotation !== 0) {
    const centerX = x + width / 2;
    const centerY = y + height / 2;
    ctx.translate(centerX, centerY);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.translate(-centerX, -centerY);
  }

  // Draw shape
  ctx.fillStyle = fillColor;
  ctx.beginPath();

  if (shape === 'CIRCLE') {
    const radius = Math.min(width, height) / 2;
    ctx.arc(x + width / 2, y + height / 2, radius, 0, Math.PI * 2);
  } else {
    // RECTANGLE with rounded corners
    ctx.roundRect(x, y, width, height, 4);
  }

  ctx.fill();

  // Draw border for selected/hovered seats
  if (isSelected || isHovered) {
    ctx.strokeStyle = DEFAULT_COLORS.border;
    ctx.lineWidth = 2 / scale;
    ctx.stroke();
  }

  // Draw seat number (only when zoomed in enough)
  if (showNumbers) {
    // Auto-scale font size based on seat size
    const fontSize = Math.min(width, height) * 0.4;

    if (fontSize >= 6) {
      ctx.fillStyle = DEFAULT_COLORS.text;
      ctx.font = `${fontSize}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(seat.number, x + width / 2, y + height / 2);
    }
  }

  ctx.restore();
}

function drawZoomIndicator(
  ctx: CanvasRenderingContext2D,
  scale: number,
  canvasSize: { width: number; height: number }
) {
  const text = `${Math.round(scale * 100)}%`;
  const padding = 8;
  const x = canvasSize.width - 10;
  const y = canvasSize.height - 15;

  // Background
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  const metrics = ctx.measureText(text);
  ctx.fillRect(
    x - metrics.width - padding * 2,
    y - 10,
    metrics.width + padding * 2,
    20
  );

  // Text
  ctx.fillStyle = '#ffffff';
  ctx.font = '12px system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x - padding, y);
}

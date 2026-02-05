'use client';

import React, { useRef, useEffect, useCallback, useState } from 'react';
import type {
  DesignerSeat,
  DesignerSection,
  DesignerStage,
  DesignerAisle,
  ToolType,
  Point,
} from './types';
import { DEFAULT_GRID_SIZE } from './types';
import { screenToCanvas, snapPointToGrid, getSectionForSeat } from './helpers';

// ============================================================================
// CANVAS COMPONENT
// ============================================================================

interface CanvasProps {
  width: number;
  height: number;
  zoom: number;
  panX: number;
  panY: number;
  seats: DesignerSeat[];
  sections: DesignerSection[];
  stage: DesignerStage | null;
  aisles: DesignerAisle[];
  selectedSeatIds: Set<string>;
  activeTool: ToolType;
  isDrawing: boolean;
  drawStart: Point | null;
  currentPoints: Point[];
  gridSnap: boolean;
  gridSize: number;
  showSeatNumbers: boolean;
  showGrid: boolean;
  onCanvasClick: (point: Point, event: React.MouseEvent) => void;
  onCanvasMouseDown: (point: Point, event: React.MouseEvent) => void;
  onCanvasMouseMove: (point: Point, event: React.MouseEvent) => void;
  onCanvasMouseUp: (point: Point, event: React.MouseEvent) => void;
  onSeatClick: (seatId: string, event: React.MouseEvent) => void;
  onPanChange: (panX: number, panY: number) => void;
}

export const Canvas: React.FC<CanvasProps> = ({
  width,
  height,
  zoom,
  panX,
  panY,
  seats,
  sections,
  stage,
  aisles,
  selectedSeatIds,
  activeTool,
  isDrawing,
  drawStart,
  currentPoints,
  gridSnap,
  gridSize,
  showSeatNumbers,
  showGrid,
  onCanvasClick,
  onCanvasMouseDown,
  onCanvasMouseMove,
  onCanvasMouseUp,
  onSeatClick,
  onPanChange,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [lastPanPoint, setLastPanPoint] = useState<Point>({ x: 0, y: 0 });
  const [selectionBox, setSelectionBox] = useState<{ start: Point; end: Point } | null>(null);
  const [mousePos, setMousePos] = useState<Point>({ x: 0, y: 0 });

  // ===========================================================================
  // COORDINATE HELPERS
  // ===========================================================================

  const getCanvasPoint = useCallback(
    (e: React.MouseEvent): Point => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };

      const rect = canvas.getBoundingClientRect();
      return screenToCanvas(e.clientX, e.clientY, panX, panY, zoom, rect);
    },
    [panX, panY, zoom]
  );

  const getSnappedPoint = useCallback(
    (point: Point): Point => {
      return snapPointToGrid(point, gridSize, gridSnap);
    },
    [gridSize, gridSnap]
  );

  // ===========================================================================
  // RENDERING
  // ===========================================================================

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;

    // Clear
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Apply transforms
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.translate(panX, panY);
    ctx.scale(zoom, zoom);

    // Draw grid
    if (showGrid) {
      drawGrid(ctx, width, height, gridSize);
    }

    // Draw aisles
    for (const aisle of aisles) {
      drawAisle(ctx, aisle);
    }

    // Draw current aisle being drawn
    if (activeTool === 'aisle' && currentPoints.length > 0) {
      drawAislePath(ctx, currentPoints, '#60a5fa');
    }

    // Draw stage
    if (stage) {
      drawStage(ctx, stage);
    }

    // Draw stage being drawn
    if (activeTool === 'stage' && drawStart && selectionBox) {
      const box = normalizeBox(selectionBox.start, selectionBox.end);
      drawStagePreview(ctx, box);
    }

    // Draw seats
    for (const seat of seats) {
      const section = getSectionForSeat(seat.id, sections);
      const isSelected = selectedSeatIds.has(seat.id);
      drawSeat(ctx, seat, section, isSelected, showSeatNumbers, zoom);
    }

    // Draw selection box
    if (activeTool === 'select' && selectionBox) {
      drawSelectionBox(ctx, selectionBox.start, selectionBox.end);
    }

    // Draw seat preview
    if (activeTool === 'seat' && !isDrawing) {
      const snapped = getSnappedPoint(mousePos);
      drawSeatPreview(ctx, snapped.x, snapped.y);
    }

    // Draw row preview
    if (activeTool === 'seat' && isDrawing && drawStart) {
      const snapped = getSnappedPoint(mousePos);
      drawRowPreview(ctx, drawStart, snapped);
    }

    ctx.restore();
  }, [
    width,
    height,
    zoom,
    panX,
    panY,
    seats,
    sections,
    stage,
    aisles,
    selectedSeatIds,
    activeTool,
    isDrawing,
    drawStart,
    currentPoints,
    gridSnap,
    gridSize,
    showSeatNumbers,
    showGrid,
    selectionBox,
    mousePos,
    getSnappedPoint,
  ]);

  // ===========================================================================
  // SETUP CANVAS
  // ===========================================================================

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    render();
  }, [width, height, render]);

  // Render on state change
  useEffect(() => {
    const animationId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationId);
  }, [render]);

  // ===========================================================================
  // EVENT HANDLERS
  // ===========================================================================

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const point = getCanvasPoint(e);
      const snappedPoint = getSnappedPoint(point);

      // Middle button or space + click for panning
      if (e.button === 1 || (e.button === 0 && e.altKey)) {
        setIsPanning(true);
        setLastPanPoint({ x: e.clientX, y: e.clientY });
        return;
      }

      // Check if clicking on a seat
      if (activeTool === 'select') {
        const clickedSeat = findSeatAtPoint(point, seats);
        if (clickedSeat) {
          onSeatClick(clickedSeat.id, e);
          return;
        }

        // Start selection box
        setSelectionBox({ start: point, end: point });
      }

      onCanvasMouseDown(snappedPoint, e);
    },
    [getCanvasPoint, getSnappedPoint, activeTool, seats, onCanvasMouseDown, onSeatClick]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const point = getCanvasPoint(e);
      const snappedPoint = getSnappedPoint(point);
      setMousePos(point);

      // Panning
      if (isPanning) {
        const dx = e.clientX - lastPanPoint.x;
        const dy = e.clientY - lastPanPoint.y;
        onPanChange(panX + dx, panY + dy);
        setLastPanPoint({ x: e.clientX, y: e.clientY });
        return;
      }

      // Update selection box
      if (selectionBox) {
        setSelectionBox({ ...selectionBox, end: point });
      }

      onCanvasMouseMove(snappedPoint, e);
    },
    [getCanvasPoint, getSnappedPoint, isPanning, lastPanPoint, panX, panY, selectionBox, onPanChange, onCanvasMouseMove]
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => {
      const point = getCanvasPoint(e);
      const snappedPoint = getSnappedPoint(point);

      if (isPanning) {
        setIsPanning(false);
        return;
      }

      // Finalize selection box
      if (selectionBox && activeTool === 'select') {
        onCanvasMouseUp(snappedPoint, e);
        setSelectionBox(null);
        return;
      }

      setSelectionBox(null);
      onCanvasMouseUp(snappedPoint, e);
    },
    [getCanvasPoint, getSnappedPoint, isPanning, selectionBox, activeTool, onCanvasMouseUp]
  );

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (isPanning) return;

      const point = getCanvasPoint(e);
      const snappedPoint = getSnappedPoint(point);

      // Don't fire click if we were drawing a selection box
      if (selectionBox) return;

      onCanvasClick(snappedPoint, e);
    },
    [isPanning, selectionBox, getCanvasPoint, getSnappedPoint, onCanvasClick]
  );

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      // Double-click to finalize aisle
      if (activeTool === 'aisle' && currentPoints.length > 1) {
        onCanvasMouseUp(getCanvasPoint(e), e);
      }
    },
    [activeTool, currentPoints, getCanvasPoint, onCanvasMouseUp]
  );

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      // Zoom with scroll
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      const newZoom = Math.max(0.5, Math.min(2, zoom + delta));

      // Zoom towards mouse position
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const scaleChange = newZoom / zoom;
      const newPanX = mouseX - (mouseX - panX) * scaleChange;
      const newPanY = mouseY - (mouseY - panY) * scaleChange;

      onPanChange(newPanX, newPanY);
    },
    [zoom, panX, panY, onPanChange]
  );

  // ===========================================================================
  // CURSOR STYLE
  // ===========================================================================

  const getCursor = () => {
    if (isPanning) return 'grabbing';
    switch (activeTool) {
      case 'select':
        return 'default';
      case 'seat':
        return 'crosshair';
      case 'stage':
        return 'crosshair';
      case 'aisle':
        return 'crosshair';
      case 'section':
        return 'crosshair';
      default:
        return 'default';
    }
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        flex: 1,
        overflow: 'hidden',
        background: '#0f172a',
        borderRadius: 8,
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          display: 'block',
          cursor: getCursor(),
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onWheel={handleWheel}
        onContextMenu={(e) => e.preventDefault()}
      />

      {/* Canvas dimensions indicator */}
      <div
        style={{
          position: 'absolute',
          bottom: 8,
          left: 8,
          padding: '4px 8px',
          background: 'rgba(0,0,0,0.6)',
          borderRadius: 4,
          fontSize: 11,
          color: '#9ca3af',
        }}
      >
        {width} x {height} | Zoom: {Math.round(zoom * 100)}%
      </div>

      {/* Mouse coordinates */}
      <div
        style={{
          position: 'absolute',
          bottom: 8,
          right: 8,
          padding: '4px 8px',
          background: 'rgba(0,0,0,0.6)',
          borderRadius: 4,
          fontSize: 11,
          color: '#9ca3af',
        }}
      >
        X: {Math.round(mousePos.x)}, Y: {Math.round(mousePos.y)}
      </div>
    </div>
  );
};

// ============================================================================
// DRAWING HELPERS
// ============================================================================

function drawGrid(ctx: CanvasRenderingContext2D, width: number, height: number, gridSize: number) {
  ctx.strokeStyle = 'rgba(55, 65, 81, 0.5)';
  ctx.lineWidth = 0.5;

  // Vertical lines
  for (let x = 0; x <= width; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }

  // Horizontal lines
  for (let y = 0; y <= height; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  // Border
  ctx.strokeStyle = '#4b5563';
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, width, height);
}

function drawSeat(
  ctx: CanvasRenderingContext2D,
  seat: DesignerSeat,
  section: { color: string } | null,
  isSelected: boolean,
  showNumbers: boolean,
  zoom: number
) {
  const { x, y, width, height, shape, rotation, row, number } = seat;

  ctx.save();

  // Apply rotation
  if (rotation !== 0) {
    const centerX = x + width / 2;
    const centerY = y + height / 2;
    ctx.translate(centerX, centerY);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.translate(-centerX, -centerY);
  }

  // Fill color
  ctx.fillStyle = section?.color || '#3b82f6';

  // Draw shape
  if (shape === 'CIRCLE') {
    const radius = Math.min(width, height) / 2;
    ctx.beginPath();
    ctx.arc(x + width / 2, y + height / 2, radius, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, 4);
    ctx.fill();
  }

  // Selection border
  if (isSelected) {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    if (shape === 'CIRCLE') {
      const radius = Math.min(width, height) / 2;
      ctx.beginPath();
      ctx.arc(x + width / 2, y + height / 2, radius + 2, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.strokeRect(x - 2, y - 2, width + 4, height + 4);
    }

    // Resize handles
    const handleSize = 6;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x - handleSize / 2, y - handleSize / 2, handleSize, handleSize);
    ctx.fillRect(x + width - handleSize / 2, y - handleSize / 2, handleSize, handleSize);
    ctx.fillRect(x - handleSize / 2, y + height - handleSize / 2, handleSize, handleSize);
    ctx.fillRect(x + width - handleSize / 2, y + height - handleSize / 2, handleSize, handleSize);
  }

  // Seat number
  if (showNumbers && zoom >= 0.8) {
    ctx.fillStyle = '#ffffff';
    ctx.font = `${Math.min(width, height) * 0.4}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(number, x + width / 2, y + height / 2);
  }

  ctx.restore();
}

function drawSeatPreview(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = 'rgba(59, 130, 246, 0.5)';
  ctx.strokeStyle = '#3b82f6';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x, y, 30, 30, 4);
  ctx.fill();
  ctx.stroke();
}

function drawRowPreview(ctx: CanvasRenderingContext2D, start: Point, end: Point) {
  const spacing = 35;
  const distance = Math.abs(end.x - start.x);
  const count = Math.max(1, Math.floor(distance / spacing) + 1);

  ctx.fillStyle = 'rgba(59, 130, 246, 0.3)';
  ctx.strokeStyle = '#3b82f6';
  ctx.lineWidth = 1;

  for (let i = 0; i < count; i++) {
    const x = start.x + i * spacing;
    ctx.beginPath();
    ctx.roundRect(x, start.y, 30, 30, 4);
    ctx.fill();
    ctx.stroke();
  }
}

function drawStage(ctx: CanvasRenderingContext2D, stage: DesignerStage) {
  ctx.fillStyle = '#1e293b';
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 2;

  ctx.beginPath();
  ctx.roundRect(stage.x, stage.y, stage.width, stage.height, 8);
  ctx.fill();
  ctx.stroke();

  // Label
  ctx.fillStyle = '#e2e8f0';
  ctx.font = 'bold 16px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(stage.label, stage.x + stage.width / 2, stage.y + stage.height / 2);
}

function drawStagePreview(ctx: CanvasRenderingContext2D, box: { x: number; y: number; width: number; height: number }) {
  ctx.fillStyle = 'rgba(30, 41, 59, 0.5)';
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 5]);

  ctx.beginPath();
  ctx.roundRect(box.x, box.y, box.width, box.height, 8);
  ctx.fill();
  ctx.stroke();

  ctx.setLineDash([]);
}

function drawAisle(ctx: CanvasRenderingContext2D, aisle: DesignerAisle) {
  if (aisle.points.length < 2) return;

  ctx.strokeStyle = '#4b5563';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.beginPath();
  ctx.moveTo(aisle.points[0].x, aisle.points[0].y);
  for (let i = 1; i < aisle.points.length; i++) {
    ctx.lineTo(aisle.points[i].x, aisle.points[i].y);
  }
  ctx.stroke();
}

function drawAislePath(ctx: CanvasRenderingContext2D, points: Point[], color: string) {
  if (points.length < 1) return;

  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.setLineDash([5, 5]);

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.stroke();

  ctx.setLineDash([]);

  // Draw points
  ctx.fillStyle = color;
  for (const point of points) {
    ctx.beginPath();
    ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawSelectionBox(ctx: CanvasRenderingContext2D, start: Point, end: Point) {
  const box = normalizeBox(start, end);

  ctx.fillStyle = 'rgba(59, 130, 246, 0.1)';
  ctx.strokeStyle = '#3b82f6';
  ctx.lineWidth = 1;
  ctx.setLineDash([5, 5]);

  ctx.fillRect(box.x, box.y, box.width, box.height);
  ctx.strokeRect(box.x, box.y, box.width, box.height);

  ctx.setLineDash([]);
}

function normalizeBox(start: Point, end: Point): { x: number; y: number; width: number; height: number } {
  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
  };
}

function findSeatAtPoint(point: Point, seats: DesignerSeat[]): DesignerSeat | null {
  // Search in reverse to get top-most seat
  for (let i = seats.length - 1; i >= 0; i--) {
    const seat = seats[i];
    if (
      point.x >= seat.x &&
      point.x <= seat.x + seat.width &&
      point.y >= seat.y &&
      point.y <= seat.y + seat.height
    ) {
      return seat;
    }
  }
  return null;
}

export default Canvas;

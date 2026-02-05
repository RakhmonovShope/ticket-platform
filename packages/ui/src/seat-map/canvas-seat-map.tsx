'use client';

import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import type { CanvasSeatMapProps, Seat, TooltipData } from './types';
import { useZoomPan } from './use-zoom-pan';
import { useCanvas } from './use-canvas';
import { SeatTooltip } from './tooltip';
import { SeatMapControls } from './controls';

const DEFAULT_WIDTH = 800;
const DEFAULT_HEIGHT = 600;
const DEFAULT_MIN_ZOOM = 0.5;
const DEFAULT_MAX_ZOOM = 3;
const DEFAULT_BACKGROUND = '#0f172a';

export const CanvasSeatMap: React.FC<CanvasSeatMapProps> = ({
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT,
  seats,
  selectedSeats,
  onSeatClick,
  onSeatHover,
  readOnly = false,
  minZoom = DEFAULT_MIN_ZOOM,
  maxZoom = DEFAULT_MAX_ZOOM,
  showTooltip = true,
  stage,
  aisles,
  className,
  backgroundColor = DEFAULT_BACKGROUND,
}) => {
  // =========================================================================
  // STATE
  // =========================================================================

  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width, height });
  const [hoveredSeat, setHoveredSeat] = useState<Seat | null>(null);
  const [tooltipData, setTooltipData] = useState<TooltipData | null>(null);
  const [isPanningMode, setIsPanningMode] = useState(false);

  // Memoize selected seats as Set for O(1) lookups
  const selectedSeatIds = useMemo(() => new Set(selectedSeats), [selectedSeats]);

  // =========================================================================
  // CUSTOM HOOKS
  // =========================================================================

  const {
    viewport,
    isPanning,
    handlers: zoomPanHandlers,
    controls,
  } = useZoomPan({
    minZoom,
    maxZoom,
  });

  const {
    canvasRef,
    render,
    findSeatAtPoint,
    screenToWorld,
    worldToScreen,
    calculateBounds,
  } = useCanvas({
    seats,
    selectedSeats: selectedSeatIds,
    hoveredSeatId: hoveredSeat?.id ?? null,
    viewport,
    stage,
    aisles,
    backgroundColor,
    canvasSize,
  });

  // =========================================================================
  // ANIMATION LOOP
  // =========================================================================

  useEffect(() => {
    let animationId: number;

    const animate = () => {
      render();
      animationId = requestAnimationFrame(animate);
    };

    animationId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [render]);

  // =========================================================================
  // RESIZE OBSERVER
  // =========================================================================

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setCanvasSize({
          width: entry.contentRect.width || width,
          height: entry.contentRect.height || height,
        });
      }
    });

    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, [width, height]);

  // =========================================================================
  // FIT TO VIEW ON MOUNT
  // =========================================================================

  useEffect(() => {
    if (seats.length > 0) {
      const bounds = calculateBounds();
      if (bounds.minX !== Infinity) {
        controls.fitToView(bounds, canvasSize);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seats.length > 0]);

  // =========================================================================
  // EVENT HANDLERS
  // =========================================================================

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas || readOnly) return;

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const seat = findSeatAtPoint(x, y);

      if (!seat) {
        // No seat clicked - start panning
        setIsPanningMode(true);
        zoomPanHandlers.onMouseDown(e.nativeEvent);
      }
      // If seat clicked, we'll handle it in mouseUp
    },
    [readOnly, findSeatAtPoint, zoomPanHandlers, canvasRef]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // Handle panning
      if (isPanningMode) {
        zoomPanHandlers.onMouseMove(e.nativeEvent);
        return;
      }

      // Handle hover
      if (readOnly) return;

      const seat = findSeatAtPoint(x, y);

      if (seat !== hoveredSeat) {
        setHoveredSeat(seat);
        onSeatHover?.(seat);

        if (seat && showTooltip && seat.status !== 'HIDDEN') {
          // Position tooltip in screen coordinates
          const screenPos = worldToScreen(
            seat.x + seat.width / 2,
            seat.y
          );
          setTooltipData({
            seat,
            x: screenPos.x,
            y: screenPos.y - 10,
          });
        } else {
          setTooltipData(null);
        }
      }
    },
    [
      readOnly,
      isPanningMode,
      findSeatAtPoint,
      hoveredSeat,
      onSeatHover,
      showTooltip,
      worldToScreen,
      zoomPanHandlers,
      canvasRef,
    ]
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const wasPanning = isPanningMode;
      setIsPanningMode(false);
      zoomPanHandlers.onMouseUp();

      if (readOnly || wasPanning) return;

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const seat = findSeatAtPoint(x, y);

      if (seat && seat.status === 'AVAILABLE') {
        onSeatClick(seat);
      }
    },
    [readOnly, isPanningMode, findSeatAtPoint, onSeatClick, zoomPanHandlers, canvasRef]
  );

  const handleMouseLeave = useCallback(() => {
    setIsPanningMode(false);
    zoomPanHandlers.onMouseUp();
    setHoveredSeat(null);
    setTooltipData(null);
    onSeatHover?.(null);
  }, [onSeatHover, zoomPanHandlers]);

  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      zoomPanHandlers.onWheel(e.nativeEvent, rect);
    },
    [zoomPanHandlers, canvasRef]
  );

  // =========================================================================
  // TOUCH HANDLERS
  // =========================================================================

  const handleTouchStart = useCallback(
    (e: React.TouchEvent<HTMLCanvasElement>) => {
      if (readOnly) return;
      zoomPanHandlers.onTouchStart(e.nativeEvent);
    },
    [readOnly, zoomPanHandlers]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent<HTMLCanvasElement>) => {
      if (readOnly) return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      zoomPanHandlers.onTouchMove(e.nativeEvent, rect);
    },
    [readOnly, zoomPanHandlers, canvasRef]
  );

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent<HTMLCanvasElement>) => {
      if (readOnly) return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      // Handle tap to select seat
      if (e.changedTouches.length === 1) {
        const touch = e.changedTouches[0];
        const rect = canvas.getBoundingClientRect();
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;

        const seat = findSeatAtPoint(x, y);
        if (seat && seat.status === 'AVAILABLE') {
          onSeatClick(seat);
        }
      }

      zoomPanHandlers.onTouchEnd();
    },
    [readOnly, findSeatAtPoint, onSeatClick, zoomPanHandlers, canvasRef]
  );

  // =========================================================================
  // CURSOR STYLE
  // =========================================================================

  const cursorStyle = useMemo(() => {
    if (isPanning || isPanningMode) return 'grabbing';
    if (hoveredSeat && hoveredSeat.status === 'AVAILABLE') return 'pointer';
    return 'grab';
  }, [isPanning, isPanningMode, hoveredSeat]);

  // =========================================================================
  // RENDER
  // =========================================================================

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        minWidth: width,
        minHeight: height,
        overflow: 'hidden',
        backgroundColor,
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          cursor: readOnly ? 'default' : cursorStyle,
          touchAction: 'none',
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onContextMenu={(e) => e.preventDefault()}
      />

      {/* Zoom Controls */}
      <SeatMapControls
        zoom={viewport.scale}
        onZoomIn={controls.zoomIn}
        onZoomOut={controls.zoomOut}
        onReset={controls.resetView}
        minZoom={minZoom}
        maxZoom={maxZoom}
      />

      {/* Tooltip */}
      {showTooltip && tooltipData && !isPanningMode && (
        <SeatTooltip
          seat={tooltipData.seat}
          x={tooltipData.x}
          y={tooltipData.y}
          isSelected={selectedSeatIds.has(tooltipData.seat.id)}
        />
      )}
    </div>
  );
};

export default CanvasSeatMap;

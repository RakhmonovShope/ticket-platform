'use client';

import { useState, useCallback, useRef, type RefObject } from 'react';
import type { Viewport, Point } from './types';

interface UseZoomPanOptions {
  minZoom: number;
  maxZoom: number;
  initialViewport?: Viewport;
}

interface UseZoomPanReturn {
  viewport: Viewport;
  isPanning: boolean;
  handlers: {
    onWheel: (e: WheelEvent, canvasRect: DOMRect) => void;
    onMouseDown: (e: MouseEvent) => void;
    onMouseMove: (e: MouseEvent) => void;
    onMouseUp: () => void;
    onTouchStart: (e: TouchEvent) => void;
    onTouchMove: (e: TouchEvent, canvasRect: DOMRect) => void;
    onTouchEnd: () => void;
  };
  controls: {
    zoomIn: () => void;
    zoomOut: () => void;
    resetView: () => void;
    fitToView: (bounds: { minX: number; minY: number; maxX: number; maxY: number }, canvasSize: { width: number; height: number }) => void;
  };
  setViewport: React.Dispatch<React.SetStateAction<Viewport>>;
}

/**
 * Custom hook for managing zoom and pan interactions
 */
export function useZoomPan({
  minZoom,
  maxZoom,
  initialViewport = { x: 0, y: 0, scale: 1 },
}: UseZoomPanOptions): UseZoomPanReturn {
  const [viewport, setViewport] = useState<Viewport>(initialViewport);
  const [isPanning, setIsPanning] = useState(false);
  
  const lastPanPoint = useRef<Point>({ x: 0, y: 0 });
  const touchState = useRef<{
    lastDistance: number;
    lastCenter: Point;
  }>({
    lastDistance: 0,
    lastCenter: { x: 0, y: 0 },
  });

  // =========================================================================
  // MOUSE WHEEL ZOOM
  // =========================================================================

  const onWheel = useCallback(
    (e: WheelEvent, canvasRect: DOMRect) => {
      e.preventDefault();

      const mouseX = e.clientX - canvasRect.left;
      const mouseY = e.clientY - canvasRect.top;

      // Zoom factor: scroll up = zoom in, scroll down = zoom out
      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;

      setViewport((v) => {
        const newScale = Math.min(Math.max(v.scale * zoomFactor, minZoom), maxZoom);
        const scaleChange = newScale / v.scale;

        // Zoom centered on mouse position
        return {
          x: mouseX - (mouseX - v.x) * scaleChange,
          y: mouseY - (mouseY - v.y) * scaleChange,
          scale: newScale,
        };
      });
    },
    [minZoom, maxZoom]
  );

  // =========================================================================
  // MOUSE PAN
  // =========================================================================

  const onMouseDown = useCallback((e: MouseEvent) => {
    // Left click to pan (no shift required now)
    if (e.button === 0) {
      setIsPanning(true);
      lastPanPoint.current = { x: e.clientX, y: e.clientY };
    }
  }, []);

  const onMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isPanning) return;

      const dx = e.clientX - lastPanPoint.current.x;
      const dy = e.clientY - lastPanPoint.current.y;
      lastPanPoint.current = { x: e.clientX, y: e.clientY };

      setViewport((v) => ({
        ...v,
        x: v.x + dx,
        y: v.y + dy,
      }));
    },
    [isPanning]
  );

  const onMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  // =========================================================================
  // TOUCH GESTURES
  // =========================================================================

  const onTouchStart = useCallback((e: TouchEvent) => {
    const touches = e.touches;

    if (touches.length === 2) {
      // Pinch zoom start
      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      touchState.current.lastDistance = Math.sqrt(dx * dx + dy * dy);
      touchState.current.lastCenter = {
        x: (touches[0].clientX + touches[1].clientX) / 2,
        y: (touches[0].clientY + touches[1].clientY) / 2,
      };
    } else if (touches.length === 1) {
      // Single touch pan
      setIsPanning(true);
      lastPanPoint.current = { x: touches[0].clientX, y: touches[0].clientY };
    }
  }, []);

  const onTouchMove = useCallback(
    (e: TouchEvent, canvasRect: DOMRect) => {
      const touches = e.touches;

      if (touches.length === 2) {
        // Pinch zoom
        const dx = touches[0].clientX - touches[1].clientX;
        const dy = touches[0].clientY - touches[1].clientY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const center = {
          x: (touches[0].clientX + touches[1].clientX) / 2,
          y: (touches[0].clientY + touches[1].clientY) / 2,
        };

        if (touchState.current.lastDistance > 0) {
          const zoomFactor = distance / touchState.current.lastDistance;

          setViewport((v) => {
            const newScale = Math.min(Math.max(v.scale * zoomFactor, minZoom), maxZoom);
            const scaleChange = newScale / v.scale;
            const touchX = center.x - canvasRect.left;
            const touchY = center.y - canvasRect.top;

            const panX = center.x - touchState.current.lastCenter.x;
            const panY = center.y - touchState.current.lastCenter.y;

            return {
              x: touchX - (touchX - v.x) * scaleChange + panX,
              y: touchY - (touchY - v.y) * scaleChange + panY,
              scale: newScale,
            };
          });
        }

        touchState.current.lastDistance = distance;
        touchState.current.lastCenter = center;
      } else if (touches.length === 1 && isPanning) {
        // Single finger pan
        const dx = touches[0].clientX - lastPanPoint.current.x;
        const dy = touches[0].clientY - lastPanPoint.current.y;
        lastPanPoint.current = { x: touches[0].clientX, y: touches[0].clientY };

        setViewport((v) => ({
          ...v,
          x: v.x + dx,
          y: v.y + dy,
        }));
      }
    },
    [isPanning, minZoom, maxZoom]
  );

  const onTouchEnd = useCallback(() => {
    setIsPanning(false);
    touchState.current.lastDistance = 0;
  }, []);

  // =========================================================================
  // CONTROL FUNCTIONS
  // =========================================================================

  const zoomIn = useCallback(() => {
    setViewport((v) => ({
      ...v,
      scale: Math.min(v.scale * 1.2, maxZoom),
    }));
  }, [maxZoom]);

  const zoomOut = useCallback(() => {
    setViewport((v) => ({
      ...v,
      scale: Math.max(v.scale / 1.2, minZoom),
    }));
  }, [minZoom]);

  const resetView = useCallback(() => {
    setViewport({ x: 0, y: 0, scale: 1 });
  }, []);

  const fitToView = useCallback(
    (
      bounds: { minX: number; minY: number; maxX: number; maxY: number },
      canvasSize: { width: number; height: number }
    ) => {
      const contentWidth = bounds.maxX - bounds.minX;
      const contentHeight = bounds.maxY - bounds.minY;
      const padding = 40;

      const scaleX = (canvasSize.width - padding * 2) / contentWidth;
      const scaleY = (canvasSize.height - padding * 2) / contentHeight;
      const scale = Math.min(Math.max(Math.min(scaleX, scaleY), minZoom), maxZoom);

      const centerX = bounds.minX + contentWidth / 2;
      const centerY = bounds.minY + contentHeight / 2;

      setViewport({
        x: canvasSize.width / 2 - centerX * scale,
        y: canvasSize.height / 2 - centerY * scale,
        scale,
      });
    },
    [minZoom, maxZoom]
  );

  return {
    viewport,
    isPanning,
    handlers: {
      onWheel,
      onMouseDown,
      onMouseMove,
      onMouseUp,
      onTouchStart,
      onTouchMove,
      onTouchEnd,
    },
    controls: {
      zoomIn,
      zoomOut,
      resetView,
      fitToView,
    },
    setViewport,
  };
}

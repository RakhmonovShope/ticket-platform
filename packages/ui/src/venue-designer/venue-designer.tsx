'use client';

import React, { useCallback, useEffect, useRef } from 'react';
import type { VenueDesignerProps, Point } from './types';
import { DEFAULT_CANVAS_WIDTH, DEFAULT_CANVAS_HEIGHT } from './types';
import { DesignerProvider, useDesigner } from './context';
import { Toolbar } from './toolbar';
import { PropertiesPanel } from './properties-panel';
import { Canvas } from './canvas';
import { LayerPanel } from './layer-panel';
import { normalizeSelectionBox, findSeatsInBounds } from './helpers';

// ============================================================================
// MAIN VENUE DESIGNER COMPONENT
// ============================================================================

const VenueDesignerInner: React.FC = () => {
  const {
    state,
    setTool,
    setZoom,
    setPan,
    toggleGridSnap,
    toggleShowNumbers,
    toggleShowGrid,
    addSeat,
    addSeatRow,
    updateSelectedSeats,
    deleteSelectedSeats,
    duplicateSelectedSeats,
    selectSeat,
    selectSeatsInBounds,
    clearSelection,
    createSectionFromSelection,
    updateSection,
    deleteSection,
    addStage,
    updateStage,
    removeStage,
    addAisle,
    deleteAisle,
    startDrawing,
    addPoint,
    endDrawing,
    cancelDrawing,
    canUndo,
    canRedo,
    undo,
    redo,
    pushHistory,
    exportSchema,
    importSchema,
    clearAll,
    selectedSeats,
    selectedSection,
  } = useDesigner();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const drawStartRef = useRef<Point | null>(null);

  // ===========================================================================
  // KEYBOARD SHORTCUTS
  // ===========================================================================

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Delete/Backspace - remove selected
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        deleteSelectedSeats();
        return;
      }

      // Ctrl+Z - Undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }

      // Ctrl+Y or Ctrl+Shift+Z - Redo
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
        return;
      }

      // Ctrl+D - Duplicate
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault();
        duplicateSelectedSeats();
        return;
      }

      // Ctrl+A - Select all
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        selectSeatsInBounds(0, 0, state.canvasWidth, state.canvasHeight);
        return;
      }

      // Escape - Cancel/Clear
      if (e.key === 'Escape') {
        if (state.isDrawing) {
          cancelDrawing();
        } else {
          clearSelection();
        }
        return;
      }

      // Arrow keys - Nudge
      const nudgeAmount = e.shiftKey ? 5 : 1;
      if (state.selectedSeatIds.size > 0) {
        switch (e.key) {
          case 'ArrowUp':
            e.preventDefault();
            nudgeSelected(0, -nudgeAmount);
            break;
          case 'ArrowDown':
            e.preventDefault();
            nudgeSelected(0, nudgeAmount);
            break;
          case 'ArrowLeft':
            e.preventDefault();
            nudgeSelected(-nudgeAmount, 0);
            break;
          case 'ArrowRight':
            e.preventDefault();
            nudgeSelected(nudgeAmount, 0);
            break;
        }
      }

      // Tool shortcuts
      switch (e.key.toLowerCase()) {
        case 'v':
          setTool('select');
          break;
        case 's':
          if (!e.ctrlKey && !e.metaKey) {
            setTool('seat');
          }
          break;
        case 'c':
          if (!e.ctrlKey && !e.metaKey) {
            setTool('section');
          }
          break;
        case 't':
          setTool('stage');
          break;
        case 'a':
          if (!e.ctrlKey && !e.metaKey) {
            setTool('aisle');
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    state.selectedSeatIds,
    state.isDrawing,
    state.canvasWidth,
    state.canvasHeight,
    deleteSelectedSeats,
    duplicateSelectedSeats,
    undo,
    redo,
    cancelDrawing,
    clearSelection,
    selectSeatsInBounds,
    setTool,
  ]);

  // ===========================================================================
  // NUDGE HELPER
  // ===========================================================================

  const nudgeSelected = useCallback(
    (dx: number, dy: number) => {
      const selectedIds = Array.from(state.selectedSeatIds);
      for (const id of selectedIds) {
        const seat = state.seats.find((s) => s.id === id);
        if (seat) {
          updateSelectedSeats({ x: seat.x + dx, y: seat.y + dy });
        }
      }
      if (selectedIds.length > 0) {
        pushHistory('Nudge seats');
      }
    },
    [state.selectedSeatIds, state.seats, updateSelectedSeats, pushHistory]
  );

  // ===========================================================================
  // CANVAS EVENT HANDLERS
  // ===========================================================================

  const handleCanvasClick = useCallback(
    (point: Point, event: React.MouseEvent) => {
      switch (state.activeTool) {
        case 'select':
          // Click on empty space clears selection
          if (!event.shiftKey) {
            clearSelection();
          }
          break;

        case 'seat':
          // Single click places a seat
          if (!state.isDrawing) {
            addSeat(point.x, point.y);
          }
          break;

        case 'aisle':
          // Click adds point to aisle
          addPoint(point);
          break;
      }
    },
    [state.activeTool, state.isDrawing, clearSelection, addSeat, addPoint]
  );

  const handleCanvasMouseDown = useCallback(
    (point: Point, event: React.MouseEvent) => {
      drawStartRef.current = point;

      switch (state.activeTool) {
        case 'seat':
          // Start row drawing
          startDrawing(point);
          break;

        case 'stage':
          // Start stage drawing
          if (!state.stage) {
            startDrawing(point);
          }
          break;

        case 'aisle':
          // Start aisle
          if (!state.isDrawing) {
            startDrawing(point);
          }
          break;
      }
    },
    [state.activeTool, state.stage, state.isDrawing, startDrawing]
  );

  const handleCanvasMouseMove = useCallback(
    (point: Point, event: React.MouseEvent) => {
      // Mouse move logic is handled in Canvas component for drawing previews
    },
    []
  );

  const handleCanvasMouseUp = useCallback(
    (point: Point, event: React.MouseEvent) => {
      const start = drawStartRef.current;

      switch (state.activeTool) {
        case 'select':
          // Finalize selection box
          if (start) {
            const bounds = normalizeSelectionBox(start.x, start.y, point.x, point.y);
            if (bounds.width > 5 || bounds.height > 5) {
              const seatsInBounds = findSeatsInBounds(state.seats, bounds);
              if (event.shiftKey) {
                // Add to selection
                const newSelection = new Set([
                  ...Array.from(state.selectedSeatIds),
                  ...seatsInBounds.map((s) => s.id),
                ]);
                selectSeatsInBounds(bounds.x, bounds.y, bounds.x + bounds.width, bounds.y + bounds.height);
              } else {
                selectSeatsInBounds(bounds.x, bounds.y, bounds.x + bounds.width, bounds.y + bounds.height);
              }
            }
          }
          break;

        case 'seat':
          // Finalize row drawing
          if (start && state.isDrawing) {
            const distance = Math.abs(point.x - start.x);
            if (distance > 10) {
              addSeatRow(start.x, point.x, start.y);
            }
            endDrawing();
          }
          break;

        case 'stage':
          // Finalize stage drawing
          if (start && state.isDrawing) {
            const width = Math.abs(point.x - start.x);
            const height = Math.abs(point.y - start.y);
            if (width > 20 && height > 20) {
              addStage(
                Math.min(start.x, point.x),
                Math.min(start.y, point.y),
                width,
                height
              );
            }
            endDrawing();
          }
          break;

        case 'aisle':
          // Double-click or sufficient points finishes aisle
          if (state.currentPoints.length >= 2) {
            addAisle(state.currentPoints);
            endDrawing();
          }
          break;
      }

      drawStartRef.current = null;
    },
    [
      state.activeTool,
      state.seats,
      state.selectedSeatIds,
      state.isDrawing,
      state.currentPoints,
      selectSeatsInBounds,
      addSeatRow,
      addStage,
      addAisle,
      endDrawing,
    ]
  );

  const handleSeatClick = useCallback(
    (seatId: string, event: React.MouseEvent) => {
      selectSeat(seatId, event.shiftKey || event.ctrlKey || event.metaKey);
    },
    [selectSeat]
  );

  // ===========================================================================
  // FILE OPERATIONS
  // ===========================================================================

  const handleImport = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const schema = JSON.parse(event.target?.result as string);
          importSchema(schema);
        } catch (error) {
          console.error('Failed to import schema:', error);
          alert('Failed to import: Invalid JSON file');
        }
      };
      reader.readAsText(file);

      // Reset input
      e.target.value = '';
    },
    [importSchema]
  );

  const handleExport = useCallback(() => {
    const schema = exportSchema();
    const json = JSON.stringify(schema, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'venue-schema.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [exportSchema]);

  const handleClear = useCallback(() => {
    if (confirm('Are you sure you want to clear all? This cannot be undone.')) {
      clearAll();
    }
  }, [clearAll]);

  // ===========================================================================
  // RENDER
  // ===========================================================================

  return (
    <div
      style={{
        display: 'flex',
        height: '100%',
        minHeight: 600,
        background: '#111827',
        gap: 12,
        padding: 12,
      }}
    >
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />

      {/* Left Sidebar - Toolbar */}
      <Toolbar
        activeTool={state.activeTool}
        onToolChange={setTool}
        gridSnap={state.gridSnap}
        onGridSnapToggle={toggleGridSnap}
        showSeatNumbers={state.showSeatNumbers}
        onShowSeatNumbersToggle={toggleShowNumbers}
        showGrid={state.showGrid}
        onShowGridToggle={toggleShowGrid}
        zoom={state.zoom}
        onZoomChange={setZoom}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={undo}
        onRedo={redo}
        onImport={handleImport}
        onExport={handleExport}
        onClear={handleClear}
      />

      {/* Properties Panel */}
      <PropertiesPanel
        selectedSeats={selectedSeats}
        selectedSection={selectedSection}
        stage={state.stage}
        onSeatChange={updateSelectedSeats}
        onSectionChange={updateSection}
        onStageChange={updateStage}
        onCreateSection={createSectionFromSelection}
        onDeleteSelected={deleteSelectedSeats}
        onDuplicateSelected={duplicateSelectedSeats}
      />

      {/* Canvas */}
      <Canvas
        width={state.canvasWidth}
        height={state.canvasHeight}
        zoom={state.zoom}
        panX={state.panX}
        panY={state.panY}
        seats={state.seats}
        sections={state.sections}
        stage={state.stage}
        aisles={state.aisles}
        selectedSeatIds={state.selectedSeatIds}
        activeTool={state.activeTool}
        isDrawing={state.isDrawing}
        drawStart={state.drawStart}
        currentPoints={state.currentPoints}
        gridSnap={state.gridSnap}
        gridSize={state.gridSize}
        showSeatNumbers={state.showSeatNumbers}
        showGrid={state.showGrid}
        onCanvasClick={handleCanvasClick}
        onCanvasMouseDown={handleCanvasMouseDown}
        onCanvasMouseMove={handleCanvasMouseMove}
        onCanvasMouseUp={handleCanvasMouseUp}
        onSeatClick={handleSeatClick}
        onPanChange={setPan}
      />

      {/* Right Sidebar - Layers */}
      <LayerPanel
        sections={state.sections}
        seats={state.seats}
        stage={state.stage}
        aisles={state.aisles}
        selectedSeatIds={state.selectedSeatIds}
        selectedSectionId={state.selectedSectionId}
        onSectionSelect={(id) => {
          // Select all seats in section
          if (id) {
            const section = state.sections.find((s) => s.id === id);
            if (section) {
              selectSeatsInBounds(0, 0, state.canvasWidth, state.canvasHeight);
              // Filter to only section seats
              const sectionSeatIds = section.seatIds;
              selectSeatsInBounds(0, 0, state.canvasWidth, state.canvasHeight);
            }
          }
        }}
        onSeatSelect={selectSeat}
        onToggleSectionCollapse={() => {}}
      />
    </div>
  );
};

// ============================================================================
// WRAPPER WITH PROVIDER
// ============================================================================

export const VenueDesigner: React.FC<VenueDesignerProps> = ({
  initialSchema,
  width = DEFAULT_CANVAS_WIDTH,
  height = DEFAULT_CANVAS_HEIGHT,
  onChange,
  onSave,
  autoSaveInterval = 30000,
  className,
}) => {
  return (
    <div className={className} style={{ height: '100%' }}>
      <DesignerProvider
        initialSchema={initialSchema}
        width={width}
        height={height}
        onChange={onChange}
        autoSaveInterval={autoSaveInterval}
      >
        <VenueDesignerInner />
      </DesignerProvider>
    </div>
  );
};

export default VenueDesigner;

'use client';

import React, {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';
import type {
  DesignerState,
  DesignerSeat,
  DesignerSection,
  DesignerStage,
  DesignerAisle,
  ToolType,
  Point,
  VenueSchema,
} from './types';
import {
  DEFAULT_CANVAS_WIDTH,
  DEFAULT_CANVAS_HEIGHT,
  DEFAULT_GRID_SIZE,
  AUTO_SAVE_KEY,
} from './types';
import { useHistory, cloneHistoryState } from './use-history';
import {
  createSeat,
  createSection,
  createAisle,
  createStage,
  duplicateSeats,
  snapPointToGrid,
  checkSeatOverlap,
  findSeatsInBounds,
  normalizeSelectionBox,
  autoNumberSeat,
  getNextRow,
  exportToSchema,
  importFromSchema,
  saveToLocalStorage,
  loadFromLocalStorage,
} from './helpers';

// ============================================================================
// INITIAL STATE
// ============================================================================

const createInitialState = (
  width: number = DEFAULT_CANVAS_WIDTH,
  height: number = DEFAULT_CANVAS_HEIGHT
): DesignerState => ({
  canvasWidth: width,
  canvasHeight: height,
  zoom: 1,
  panX: 0,
  panY: 0,
  seats: [],
  sections: [],
  stage: null,
  aisles: [],
  selectedSeatIds: new Set(),
  selectedSectionId: null,
  selectedAisleId: null,
  activeTool: 'select',
  isDrawing: false,
  drawStart: null,
  currentPoints: [],
  gridSnap: true,
  gridSize: DEFAULT_GRID_SIZE,
  showSeatNumbers: true,
  showGrid: true,
  currentRow: 'A',
  currentNumber: 1,
});

// ============================================================================
// ACTION TYPES
// ============================================================================

type DesignerAction =
  | { type: 'SET_TOOL'; payload: ToolType }
  | { type: 'SET_ZOOM'; payload: number }
  | { type: 'SET_PAN'; payload: { x: number; y: number } }
  | { type: 'TOGGLE_GRID_SNAP' }
  | { type: 'TOGGLE_SHOW_NUMBERS' }
  | { type: 'TOGGLE_SHOW_GRID' }
  | { type: 'ADD_SEAT'; payload: DesignerSeat }
  | { type: 'ADD_SEATS'; payload: DesignerSeat[] }
  | { type: 'UPDATE_SEAT'; payload: { id: string; updates: Partial<DesignerSeat> } }
  | { type: 'UPDATE_SEATS'; payload: { ids: string[]; updates: Partial<DesignerSeat> } }
  | { type: 'DELETE_SEATS'; payload: string[] }
  | { type: 'SELECT_SEAT'; payload: { id: string; multiSelect: boolean } }
  | { type: 'SELECT_SEATS'; payload: string[] }
  | { type: 'CLEAR_SELECTION' }
  | { type: 'ADD_SECTION'; payload: DesignerSection }
  | { type: 'UPDATE_SECTION'; payload: { id: string; updates: Partial<DesignerSection> } }
  | { type: 'DELETE_SECTION'; payload: string }
  | { type: 'SELECT_SECTION'; payload: string | null }
  | { type: 'SET_STAGE'; payload: DesignerStage | null }
  | { type: 'UPDATE_STAGE'; payload: Partial<DesignerStage> }
  | { type: 'ADD_AISLE'; payload: DesignerAisle }
  | { type: 'DELETE_AISLE'; payload: string }
  | { type: 'START_DRAWING'; payload: Point }
  | { type: 'ADD_POINT'; payload: Point }
  | { type: 'END_DRAWING' }
  | { type: 'CANCEL_DRAWING' }
  | { type: 'SET_CURRENT_ROW'; payload: string }
  | { type: 'LOAD_STATE'; payload: { seats: DesignerSeat[]; sections: DesignerSection[]; stage: DesignerStage | null; aisles: DesignerAisle[] } }
  | { type: 'CLEAR_ALL' };

// ============================================================================
// REDUCER
// ============================================================================

function designerReducer(state: DesignerState, action: DesignerAction): DesignerState {
  switch (action.type) {
    case 'SET_TOOL':
      return { ...state, activeTool: action.payload, isDrawing: false, drawStart: null, currentPoints: [] };

    case 'SET_ZOOM':
      return { ...state, zoom: Math.max(0.5, Math.min(2, action.payload)) };

    case 'SET_PAN':
      return { ...state, panX: action.payload.x, panY: action.payload.y };

    case 'TOGGLE_GRID_SNAP':
      return { ...state, gridSnap: !state.gridSnap };

    case 'TOGGLE_SHOW_NUMBERS':
      return { ...state, showSeatNumbers: !state.showSeatNumbers };

    case 'TOGGLE_SHOW_GRID':
      return { ...state, showGrid: !state.showGrid };

    case 'ADD_SEAT':
      return { ...state, seats: [...state.seats, action.payload] };

    case 'ADD_SEATS':
      return { ...state, seats: [...state.seats, ...action.payload] };

    case 'UPDATE_SEAT':
      return {
        ...state,
        seats: state.seats.map((seat) =>
          seat.id === action.payload.id ? { ...seat, ...action.payload.updates } : seat
        ),
      };

    case 'UPDATE_SEATS':
      return {
        ...state,
        seats: state.seats.map((seat) =>
          action.payload.ids.includes(seat.id) ? { ...seat, ...action.payload.updates } : seat
        ),
      };

    case 'DELETE_SEATS': {
      const idsToDelete = new Set(action.payload);
      return {
        ...state,
        seats: state.seats.filter((seat) => !idsToDelete.has(seat.id)),
        sections: state.sections.map((section) => ({
          ...section,
          seatIds: section.seatIds.filter((id) => !idsToDelete.has(id)),
        })),
        selectedSeatIds: new Set(
          Array.from(state.selectedSeatIds).filter((id) => !idsToDelete.has(id))
        ),
      };
    }

    case 'SELECT_SEAT': {
      const newSelection = new Set(action.payload.multiSelect ? state.selectedSeatIds : []);
      if (newSelection.has(action.payload.id)) {
        newSelection.delete(action.payload.id);
      } else {
        newSelection.add(action.payload.id);
      }
      return { ...state, selectedSeatIds: newSelection };
    }

    case 'SELECT_SEATS':
      return { ...state, selectedSeatIds: new Set(action.payload) };

    case 'CLEAR_SELECTION':
      return { ...state, selectedSeatIds: new Set(), selectedSectionId: null, selectedAisleId: null };

    case 'ADD_SECTION':
      return { ...state, sections: [...state.sections, action.payload] };

    case 'UPDATE_SECTION':
      return {
        ...state,
        sections: state.sections.map((section) =>
          section.id === action.payload.id ? { ...section, ...action.payload.updates } : section
        ),
      };

    case 'DELETE_SECTION':
      return {
        ...state,
        sections: state.sections.filter((s) => s.id !== action.payload),
        selectedSectionId: state.selectedSectionId === action.payload ? null : state.selectedSectionId,
      };

    case 'SELECT_SECTION':
      return { ...state, selectedSectionId: action.payload };

    case 'SET_STAGE':
      return { ...state, stage: action.payload };

    case 'UPDATE_STAGE':
      return { ...state, stage: state.stage ? { ...state.stage, ...action.payload } : null };

    case 'ADD_AISLE':
      return { ...state, aisles: [...state.aisles, action.payload] };

    case 'DELETE_AISLE':
      return {
        ...state,
        aisles: state.aisles.filter((a) => a.id !== action.payload),
        selectedAisleId: state.selectedAisleId === action.payload ? null : state.selectedAisleId,
      };

    case 'START_DRAWING':
      return { ...state, isDrawing: true, drawStart: action.payload, currentPoints: [action.payload] };

    case 'ADD_POINT':
      return { ...state, currentPoints: [...state.currentPoints, action.payload] };

    case 'END_DRAWING':
      return { ...state, isDrawing: false, drawStart: null, currentPoints: [] };

    case 'CANCEL_DRAWING':
      return { ...state, isDrawing: false, drawStart: null, currentPoints: [] };

    case 'SET_CURRENT_ROW':
      return { ...state, currentRow: action.payload };

    case 'LOAD_STATE':
      return {
        ...state,
        seats: action.payload.seats,
        sections: action.payload.sections,
        stage: action.payload.stage,
        aisles: action.payload.aisles,
        selectedSeatIds: new Set(),
        selectedSectionId: null,
        selectedAisleId: null,
      };

    case 'CLEAR_ALL':
      return {
        ...state,
        seats: [],
        sections: [],
        stage: null,
        aisles: [],
        selectedSeatIds: new Set(),
        selectedSectionId: null,
        selectedAisleId: null,
        currentRow: 'A',
        currentNumber: 1,
      };

    default:
      return state;
  }
}

// ============================================================================
// CONTEXT TYPE
// ============================================================================

interface DesignerContextType {
  state: DesignerState;
  dispatch: React.Dispatch<DesignerAction>;

  // Tool actions
  setTool: (tool: ToolType) => void;
  setZoom: (zoom: number) => void;
  setPan: (x: number, y: number) => void;
  toggleGridSnap: () => void;
  toggleShowNumbers: () => void;
  toggleShowGrid: () => void;

  // Seat actions
  addSeat: (x: number, y: number) => DesignerSeat | null;
  addSeatRow: (startX: number, endX: number, y: number) => DesignerSeat[];
  updateSelectedSeats: (updates: Partial<DesignerSeat>) => void;
  deleteSelectedSeats: () => void;
  duplicateSelectedSeats: () => void;
  selectSeat: (id: string, multiSelect: boolean) => void;
  selectSeatsInBounds: (startX: number, startY: number, endX: number, endY: number) => void;
  clearSelection: () => void;

  // Section actions
  createSectionFromSelection: (name: string) => void;
  updateSection: (id: string, updates: Partial<DesignerSection>) => void;
  deleteSection: (id: string) => void;

  // Stage actions
  addStage: (x: number, y: number, width: number, height: number) => void;
  updateStage: (updates: Partial<DesignerStage>) => void;
  removeStage: () => void;

  // Aisle actions
  addAisle: (points: Point[]) => void;
  deleteAisle: (id: string) => void;

  // Drawing
  startDrawing: (point: Point) => void;
  addPoint: (point: Point) => void;
  endDrawing: () => void;
  cancelDrawing: () => void;

  // History
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  pushHistory: (label?: string) => void;

  // Import/Export
  exportSchema: () => VenueSchema;
  importSchema: (schema: VenueSchema) => void;
  clearAll: () => void;

  // Selected items
  selectedSeats: DesignerSeat[];
  selectedSection: DesignerSection | null;
}

const DesignerContext = createContext<DesignerContextType | null>(null);

// ============================================================================
// PROVIDER
// ============================================================================

interface DesignerProviderProps {
  children: ReactNode;
  initialSchema?: VenueSchema;
  width?: number;
  height?: number;
  onChange?: (schema: VenueSchema) => void;
  autoSaveInterval?: number;
}

export function DesignerProvider({
  children,
  initialSchema,
  width,
  height,
  onChange,
  autoSaveInterval = 30000,
}: DesignerProviderProps) {
  const [state, dispatch] = useReducer(
    designerReducer,
    createInitialState(width ?? initialSchema?.width, height ?? initialSchema?.height)
  );

  const history = useHistory({
    onChange: (historyState) => {
      dispatch({ type: 'LOAD_STATE', payload: historyState });
    },
  });

  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // ===========================================================================
  // INITIALIZE FROM SCHEMA OR LOCALSTORAGE
  // ===========================================================================

  useEffect(() => {
    // Try to load from localStorage first
    const saved = loadFromLocalStorage(AUTO_SAVE_KEY);
    const schemaToLoad = initialSchema || saved;

    if (schemaToLoad) {
      const { seats, sections, stage, aisles } = importFromSchema(schemaToLoad);
      dispatch({ type: 'LOAD_STATE', payload: { seats, sections, stage, aisles } });
      history.pushState({ seats, sections, stage, aisles }, 'Initial load');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ===========================================================================
  // AUTO-SAVE
  // ===========================================================================

  useEffect(() => {
    if (autoSaveInterval <= 0) return;

    autoSaveTimerRef.current = setInterval(() => {
      const schema = exportToSchema(
        state.seats,
        state.sections,
        state.stage,
        state.aisles,
        state.canvasWidth,
        state.canvasHeight
      );
      saveToLocalStorage(schema, AUTO_SAVE_KEY);
    }, autoSaveInterval);

    return () => {
      if (autoSaveTimerRef.current) {
        clearInterval(autoSaveTimerRef.current);
      }
    };
  }, [autoSaveInterval, state.seats, state.sections, state.stage, state.aisles, state.canvasWidth, state.canvasHeight]);

  // ===========================================================================
  // NOTIFY ON CHANGE
  // ===========================================================================

  useEffect(() => {
    if (onChange) {
      const schema = exportToSchema(
        state.seats,
        state.sections,
        state.stage,
        state.aisles,
        state.canvasWidth,
        state.canvasHeight
      );
      onChange(schema);
    }
  }, [state.seats, state.sections, state.stage, state.aisles, onChange, state.canvasWidth, state.canvasHeight]);

  // ===========================================================================
  // PUSH HISTORY
  // ===========================================================================

  const pushHistory = useCallback(
    (label: string = 'Change') => {
      history.pushState(
        cloneHistoryState({
          seats: state.seats,
          sections: state.sections,
          stage: state.stage,
          aisles: state.aisles,
        }),
        label
      );
    },
    [history, state.seats, state.sections, state.stage, state.aisles]
  );

  // ===========================================================================
  // TOOL ACTIONS
  // ===========================================================================

  const setTool = useCallback((tool: ToolType) => {
    dispatch({ type: 'SET_TOOL', payload: tool });
  }, []);

  const setZoom = useCallback((zoom: number) => {
    dispatch({ type: 'SET_ZOOM', payload: zoom });
  }, []);

  const setPan = useCallback((x: number, y: number) => {
    dispatch({ type: 'SET_PAN', payload: { x, y } });
  }, []);

  const toggleGridSnap = useCallback(() => {
    dispatch({ type: 'TOGGLE_GRID_SNAP' });
  }, []);

  const toggleShowNumbers = useCallback(() => {
    dispatch({ type: 'TOGGLE_SHOW_NUMBERS' });
  }, []);

  const toggleShowGrid = useCallback(() => {
    dispatch({ type: 'TOGGLE_SHOW_GRID' });
  }, []);

  // ===========================================================================
  // SEAT ACTIONS
  // ===========================================================================

  const addSeat = useCallback(
    (x: number, y: number): DesignerSeat | null => {
      const snappedPoint = snapPointToGrid({ x, y }, state.gridSize, state.gridSnap);

      // Check for overlap
      const newSeatBounds = {
        x: snappedPoint.x,
        y: snappedPoint.y,
        width: 30,
        height: 30,
      };

      if (checkSeatOverlap(newSeatBounds, state.seats)) {
        return null;
      }

      // Auto-number
      const { row, number } = autoNumberSeat(
        snappedPoint.x,
        snappedPoint.y,
        state.seats,
        state.currentRow,
        state.gridSize * 4
      );

      const seat = createSeat(snappedPoint.x, snappedPoint.y, { row, number });
      dispatch({ type: 'ADD_SEAT', payload: seat });
      pushHistory('Add seat');

      return seat;
    },
    [state.gridSize, state.gridSnap, state.seats, state.currentRow, pushHistory]
  );

  const addSeatRow = useCallback(
    (startX: number, endX: number, y: number): DesignerSeat[] => {
      const snappedStart = snapPointToGrid({ x: startX, y }, state.gridSize, state.gridSnap);
      const snappedEnd = snapPointToGrid({ x: endX, y }, state.gridSize, state.gridSnap);

      const spacing = 35; // seat width + gap
      const distance = Math.abs(snappedEnd.x - snappedStart.x);
      const count = Math.max(1, Math.floor(distance / spacing) + 1);

      const seats: DesignerSeat[] = [];
      let currentRow = state.currentRow;

      // Find max number in current row
      const seatsInRow = state.seats.filter((s) => s.row === currentRow);
      let startNumber = seatsInRow.reduce((max, s) => {
        const num = parseInt(s.number, 10);
        return isNaN(num) ? max : Math.max(max, num);
      }, 0) + 1;

      for (let i = 0; i < count; i++) {
        const seatX = snappedStart.x + i * spacing;
        const seat = createSeat(seatX, snappedStart.y, {
          row: currentRow,
          number: String(startNumber + i),
        });

        if (!checkSeatOverlap({ x: seat.x, y: seat.y, width: seat.width, height: seat.height }, state.seats)) {
          seats.push(seat);
        }
      }

      if (seats.length > 0) {
        dispatch({ type: 'ADD_SEATS', payload: seats });
        dispatch({ type: 'SET_CURRENT_ROW', payload: getNextRow(currentRow) });
        pushHistory(`Add ${seats.length} seats`);
      }

      return seats;
    },
    [state.gridSize, state.gridSnap, state.seats, state.currentRow, pushHistory]
  );

  const updateSelectedSeats = useCallback(
    (updates: Partial<DesignerSeat>) => {
      if (state.selectedSeatIds.size === 0) return;
      dispatch({
        type: 'UPDATE_SEATS',
        payload: { ids: Array.from(state.selectedSeatIds), updates },
      });
      pushHistory('Update seats');
    },
    [state.selectedSeatIds, pushHistory]
  );

  const deleteSelectedSeats = useCallback(() => {
    if (state.selectedSeatIds.size === 0) return;
    dispatch({ type: 'DELETE_SEATS', payload: Array.from(state.selectedSeatIds) });
    pushHistory('Delete seats');
  }, [state.selectedSeatIds, pushHistory]);

  const duplicateSelectedSeats = useCallback(() => {
    if (state.selectedSeatIds.size === 0) return;
    const selectedSeats = state.seats.filter((s) => state.selectedSeatIds.has(s.id));
    const newSeats = duplicateSeats(selectedSeats);
    dispatch({ type: 'ADD_SEATS', payload: newSeats });
    dispatch({ type: 'SELECT_SEATS', payload: newSeats.map((s) => s.id) });
    pushHistory('Duplicate seats');
  }, [state.selectedSeatIds, state.seats, pushHistory]);

  const selectSeat = useCallback((id: string, multiSelect: boolean) => {
    dispatch({ type: 'SELECT_SEAT', payload: { id, multiSelect } });
  }, []);

  const selectSeatsInBounds = useCallback(
    (startX: number, startY: number, endX: number, endY: number) => {
      const bounds = normalizeSelectionBox(startX, startY, endX, endY);
      const seatsInBounds = findSeatsInBounds(state.seats, bounds);
      dispatch({ type: 'SELECT_SEATS', payload: seatsInBounds.map((s) => s.id) });
    },
    [state.seats]
  );

  const clearSelection = useCallback(() => {
    dispatch({ type: 'CLEAR_SELECTION' });
  }, []);

  // ===========================================================================
  // SECTION ACTIONS
  // ===========================================================================

  const createSectionFromSelection = useCallback(
    (name: string) => {
      if (state.selectedSeatIds.size === 0) return;

      const section = createSection(name, Array.from(state.selectedSeatIds), state.sections);
      dispatch({ type: 'ADD_SECTION', payload: section });

      // Update seats' section field
      dispatch({
        type: 'UPDATE_SEATS',
        payload: { ids: Array.from(state.selectedSeatIds), updates: { section: name } },
      });

      pushHistory('Create section');
    },
    [state.selectedSeatIds, state.sections, pushHistory]
  );

  const updateSection = useCallback(
    (id: string, updates: Partial<DesignerSection>) => {
      dispatch({ type: 'UPDATE_SECTION', payload: { id, updates } });
      pushHistory('Update section');
    },
    [pushHistory]
  );

  const deleteSection = useCallback(
    (id: string) => {
      dispatch({ type: 'DELETE_SECTION', payload: id });
      pushHistory('Delete section');
    },
    [pushHistory]
  );

  // ===========================================================================
  // STAGE ACTIONS
  // ===========================================================================

  const addStage = useCallback(
    (x: number, y: number, width: number, height: number) => {
      const stage = createStage(state.canvasWidth, state.canvasHeight, { x, y, width, height });
      dispatch({ type: 'SET_STAGE', payload: stage });
      pushHistory('Add stage');
    },
    [state.canvasWidth, state.canvasHeight, pushHistory]
  );

  const updateStage = useCallback(
    (updates: Partial<DesignerStage>) => {
      dispatch({ type: 'UPDATE_STAGE', payload: updates });
      pushHistory('Update stage');
    },
    [pushHistory]
  );

  const removeStage = useCallback(() => {
    dispatch({ type: 'SET_STAGE', payload: null });
    pushHistory('Remove stage');
  }, [pushHistory]);

  // ===========================================================================
  // AISLE ACTIONS
  // ===========================================================================

  const addAisle = useCallback(
    (points: Point[]) => {
      if (points.length < 2) return;
      const aisle = createAisle(points);
      dispatch({ type: 'ADD_AISLE', payload: aisle });
      pushHistory('Add aisle');
    },
    [pushHistory]
  );

  const deleteAisle = useCallback(
    (id: string) => {
      dispatch({ type: 'DELETE_AISLE', payload: id });
      pushHistory('Delete aisle');
    },
    [pushHistory]
  );

  // ===========================================================================
  // DRAWING
  // ===========================================================================

  const startDrawing = useCallback((point: Point) => {
    dispatch({ type: 'START_DRAWING', payload: point });
  }, []);

  const addPoint = useCallback((point: Point) => {
    dispatch({ type: 'ADD_POINT', payload: point });
  }, []);

  const endDrawing = useCallback(() => {
    dispatch({ type: 'END_DRAWING' });
  }, []);

  const cancelDrawing = useCallback(() => {
    dispatch({ type: 'CANCEL_DRAWING' });
  }, []);

  // ===========================================================================
  // UNDO/REDO
  // ===========================================================================

  const undo = useCallback(() => {
    history.undo();
  }, [history]);

  const redo = useCallback(() => {
    history.redo();
  }, [history]);

  // ===========================================================================
  // IMPORT/EXPORT
  // ===========================================================================

  const exportSchema = useCallback((): VenueSchema => {
    return exportToSchema(
      state.seats,
      state.sections,
      state.stage,
      state.aisles,
      state.canvasWidth,
      state.canvasHeight
    );
  }, [state.seats, state.sections, state.stage, state.aisles, state.canvasWidth, state.canvasHeight]);

  const importSchema = useCallback(
    (schema: VenueSchema) => {
      const { seats, sections, stage, aisles } = importFromSchema(schema);
      dispatch({ type: 'LOAD_STATE', payload: { seats, sections, stage, aisles } });
      pushHistory('Import schema');
    },
    [pushHistory]
  );

  const clearAll = useCallback(() => {
    dispatch({ type: 'CLEAR_ALL' });
    pushHistory('Clear all');
  }, [pushHistory]);

  // ===========================================================================
  // COMPUTED VALUES
  // ===========================================================================

  const selectedSeats = state.seats.filter((s) => state.selectedSeatIds.has(s.id));
  const selectedSection = state.sections.find((s) => s.id === state.selectedSectionId) || null;

  // ===========================================================================
  // CONTEXT VALUE
  // ===========================================================================

  const value: DesignerContextType = {
    state,
    dispatch,
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
    canUndo: history.canUndo,
    canRedo: history.canRedo,
    undo,
    redo,
    pushHistory,
    exportSchema,
    importSchema,
    clearAll,
    selectedSeats,
    selectedSection,
  };

  return <DesignerContext.Provider value={value}>{children}</DesignerContext.Provider>;
}

// ============================================================================
// HOOK
// ============================================================================

export function useDesigner(): DesignerContextType {
  const context = useContext(DesignerContext);
  if (!context) {
    throw new Error('useDesigner must be used within a DesignerProvider');
  }
  return context;
}

export default DesignerContext;

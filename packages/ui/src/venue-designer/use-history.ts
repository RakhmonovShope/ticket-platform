'use client';

import { useState, useCallback, useRef } from 'react';
import type { HistoryState, HistoryEntry } from './types';
import { MAX_HISTORY_SIZE } from './types';

// ============================================================================
// USE HISTORY HOOK
// ============================================================================

export interface UseHistoryOptions {
  /** Maximum number of history entries */
  maxSize?: number;
  /** Callback when history changes */
  onChange?: (state: HistoryState) => void;
}

export interface UseHistoryReturn {
  /** Current state */
  state: HistoryState;
  /** Whether undo is possible */
  canUndo: boolean;
  /** Whether redo is possible */
  canRedo: boolean;
  /** Number of undo steps available */
  undoCount: number;
  /** Number of redo steps available */
  redoCount: number;
  /** Push a new state to history */
  pushState: (state: HistoryState, label?: string) => void;
  /** Undo to previous state */
  undo: () => HistoryState | null;
  /** Redo to next state */
  redo: () => HistoryState | null;
  /** Clear all history */
  clear: (initialState: HistoryState) => void;
  /** Get history entries (for debugging) */
  getHistory: () => HistoryEntry[];
}

const createInitialState = (): HistoryState => ({
  seats: [],
  sections: [],
  stage: null,
  aisles: [],
});

export function useHistory(options: UseHistoryOptions = {}): UseHistoryReturn {
  const { maxSize = MAX_HISTORY_SIZE, onChange } = options;

  // History stack (past states)
  const [past, setPast] = useState<HistoryEntry[]>([]);
  // Current state
  const [present, setPresent] = useState<HistoryState>(createInitialState());
  // Future stack (for redo)
  const [future, setFuture] = useState<HistoryEntry[]>([]);

  // Track if we're in the middle of an undo/redo to prevent pushing state
  const isUndoingRef = useRef(false);

  // ===========================================================================
  // PUSH STATE
  // ===========================================================================

  const pushState = useCallback(
    (newState: HistoryState, label: string = 'Change') => {
      // Don't push if we're undoing/redoing
      if (isUndoingRef.current) return;

      // Create entry for current state
      const entry: HistoryEntry = {
        state: present,
        timestamp: Date.now(),
        label,
      };

      // Add current state to past, limit size
      setPast((prev) => {
        const newPast = [...prev, entry];
        if (newPast.length > maxSize) {
          return newPast.slice(newPast.length - maxSize);
        }
        return newPast;
      });

      // Set new present
      setPresent(newState);

      // Clear future (new branch)
      setFuture([]);

      // Callback
      onChange?.(newState);
    },
    [present, maxSize, onChange]
  );

  // ===========================================================================
  // UNDO
  // ===========================================================================

  const undo = useCallback((): HistoryState | null => {
    if (past.length === 0) return null;

    isUndoingRef.current = true;

    // Get the last past entry
    const lastEntry = past[past.length - 1];

    // Create entry for current state to add to future
    const currentEntry: HistoryEntry = {
      state: present,
      timestamp: Date.now(),
      label: 'Undo',
    };

    // Update stacks
    setPast((prev) => prev.slice(0, -1));
    setFuture((prev) => [currentEntry, ...prev]);
    setPresent(lastEntry.state);

    // Callback
    onChange?.(lastEntry.state);

    // Reset flag after state update
    setTimeout(() => {
      isUndoingRef.current = false;
    }, 0);

    return lastEntry.state;
  }, [past, present, onChange]);

  // ===========================================================================
  // REDO
  // ===========================================================================

  const redo = useCallback((): HistoryState | null => {
    if (future.length === 0) return null;

    isUndoingRef.current = true;

    // Get the first future entry
    const nextEntry = future[0];

    // Create entry for current state to add to past
    const currentEntry: HistoryEntry = {
      state: present,
      timestamp: Date.now(),
      label: 'Redo',
    };

    // Update stacks
    setFuture((prev) => prev.slice(1));
    setPast((prev) => [...prev, currentEntry]);
    setPresent(nextEntry.state);

    // Callback
    onChange?.(nextEntry.state);

    // Reset flag after state update
    setTimeout(() => {
      isUndoingRef.current = false;
    }, 0);

    return nextEntry.state;
  }, [future, present, onChange]);

  // ===========================================================================
  // CLEAR
  // ===========================================================================

  const clear = useCallback(
    (initialState: HistoryState) => {
      setPast([]);
      setFuture([]);
      setPresent(initialState);
      onChange?.(initialState);
    },
    [onChange]
  );

  // ===========================================================================
  // GET HISTORY
  // ===========================================================================

  const getHistory = useCallback((): HistoryEntry[] => {
    return [
      ...past,
      { state: present, timestamp: Date.now(), label: 'Current' },
    ];
  }, [past, present]);

  return {
    state: present,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
    undoCount: past.length,
    redoCount: future.length,
    pushState,
    undo,
    redo,
    clear,
    getHistory,
  };
}

// ============================================================================
// UTILITY: DEEP CLONE STATE
// ============================================================================

export function cloneHistoryState(state: HistoryState): HistoryState {
  return {
    seats: state.seats.map((seat) => ({ ...seat })),
    sections: state.sections.map((section) => ({
      ...section,
      seatIds: [...section.seatIds],
    })),
    stage: state.stage ? { ...state.stage } : null,
    aisles: state.aisles.map((aisle) => ({
      ...aisle,
      points: aisle.points.map((p) => ({ ...p })),
    })),
  };
}

export default useHistory;

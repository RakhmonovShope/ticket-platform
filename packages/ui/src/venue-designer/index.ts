// Main component
export { VenueDesigner, default } from './venue-designer';

// Context and hooks
export { DesignerProvider, useDesigner } from './context';
export { useHistory } from './use-history';

// Sub-components
export { Toolbar } from './toolbar';
export { PropertiesPanel } from './properties-panel';
export { Canvas } from './canvas';
export { LayerPanel } from './layer-panel';

// Templates
export { VENUE_TEMPLATES, getTemplate, createEmptySchema } from './templates';
export type { VenueTemplate } from './templates';

// Types
export type {
  VenueSchema,
  DesignerSeat,
  DesignerSection,
  DesignerStage,
  DesignerAisle,
  ToolType,
  SeatShape,
  Point,
  Bounds,
  DesignerState,
  HistoryState,
  HistoryEntry,
  VenueDesignerProps,
} from './types';

// Constants
export {
  DEFAULT_SEAT_WIDTH,
  DEFAULT_SEAT_HEIGHT,
  DEFAULT_GRID_SIZE,
  DEFAULT_CANVAS_WIDTH,
  DEFAULT_CANVAS_HEIGHT,
  MIN_ZOOM,
  MAX_ZOOM,
  MAX_HISTORY_SIZE,
  AUTO_SAVE_KEY,
  TOOL_LABELS,
  DEFAULT_SECTION_COLORS,
} from './types';

// Helpers
export {
  snapToGrid,
  snapPointToGrid,
  checkRectOverlap,
  checkSeatOverlap,
  findSeatsInBounds,
  isPointInSeat,
  getNextRow,
  autoNumberSeat,
  createSeat,
  createSeatRow,
  duplicateSeats,
  createSection,
  getSectionForSeat,
  createStage,
  createAisle,
  calculateSeatsBounds,
  normalizeSelectionBox,
  exportToSchema,
  importFromSchema,
  validateSchema,
  saveToLocalStorage,
  loadFromLocalStorage,
  screenToCanvas,
  canvasToScreen,
} from './helpers';

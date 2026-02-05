/**
 * Types for the VenueDesigner component
 */

// ============================================================================
// CORE TYPES (matching VenueSchema)
// ============================================================================

export type SeatShape = 'RECTANGLE' | 'CIRCLE' | 'POLYGON';

export interface DesignerSeat {
  id: string;
  row: string;
  number: string;
  section: string;
  x: number;
  y: number;
  width: number;
  height: number;
  shape: SeatShape;
  rotation: number;
}

export interface DesignerSection {
  id: string;
  name: string;
  color: string;
  seatIds: string[];
}

export interface DesignerStage {
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
}

export interface DesignerAisle {
  id: string;
  points: Array<{ x: number; y: number }>;
}

export interface VenueSchema {
  width: number;
  height: number;
  stage?: DesignerStage;
  sections: DesignerSection[];
  seats: DesignerSeat[];
  aisles: DesignerAisle[];
}

// ============================================================================
// TOOL TYPES
// ============================================================================

export type ToolType = 'select' | 'seat' | 'section' | 'stage' | 'aisle';

export interface Point {
  x: number;
  y: number;
}

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SelectionBox {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

// ============================================================================
// DESIGNER STATE
// ============================================================================

export interface DesignerState {
  // Canvas
  canvasWidth: number;
  canvasHeight: number;
  zoom: number;
  panX: number;
  panY: number;

  // Data
  seats: DesignerSeat[];
  sections: DesignerSection[];
  stage: DesignerStage | null;
  aisles: DesignerAisle[];

  // Selection
  selectedSeatIds: Set<string>;
  selectedSectionId: string | null;
  selectedAisleId: string | null;

  // Tool state
  activeTool: ToolType;
  isDrawing: boolean;
  drawStart: Point | null;
  currentPoints: Point[]; // For aisle/section drawing

  // Settings
  gridSnap: boolean;
  gridSize: number;
  showSeatNumbers: boolean;
  showGrid: boolean;

  // Auto-numbering
  currentRow: string;
  currentNumber: number;
}

export interface DesignerAction {
  type: string;
  payload?: unknown;
}

// ============================================================================
// HISTORY
// ============================================================================

export interface HistoryState {
  seats: DesignerSeat[];
  sections: DesignerSection[];
  stage: DesignerStage | null;
  aisles: DesignerAisle[];
}

export interface HistoryEntry {
  state: HistoryState;
  timestamp: number;
  label: string;
}

// ============================================================================
// COMPONENT PROPS
// ============================================================================

export interface VenueDesignerProps {
  /** Initial venue schema */
  initialSchema?: VenueSchema;
  /** Canvas width (default 800) */
  width?: number;
  /** Canvas height (default 600) */
  height?: number;
  /** Callback when schema changes */
  onChange?: (schema: VenueSchema) => void;
  /** Callback on save */
  onSave?: (schema: VenueSchema) => void;
  /** Auto-save interval in ms (0 to disable) */
  autoSaveInterval?: number;
  /** CSS class name */
  className?: string;
}

export interface ToolbarProps {
  activeTool: ToolType;
  onToolChange: (tool: ToolType) => void;
  gridSnap: boolean;
  onGridSnapToggle: () => void;
  showSeatNumbers: boolean;
  onShowSeatNumbersToggle: () => void;
  showGrid: boolean;
  onShowGridToggle: () => void;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onImport: () => void;
  onExport: () => void;
  onClear: () => void;
}

export interface PropertiesPanelProps {
  selectedSeats: DesignerSeat[];
  selectedSection: DesignerSection | null;
  stage: DesignerStage | null;
  onSeatChange: (updates: Partial<DesignerSeat>) => void;
  onSectionChange: (updates: Partial<DesignerSection>) => void;
  onStageChange: (updates: Partial<DesignerStage>) => void;
  onCreateSection: () => void;
  onDeleteSelected: () => void;
  onDuplicateSelected: () => void;
}

export interface CanvasProps {
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
  onCanvasClick: (point: Point) => void;
  onCanvasMouseDown: (point: Point) => void;
  onCanvasMouseMove: (point: Point) => void;
  onCanvasMouseUp: (point: Point) => void;
  onSeatClick: (seatId: string, event: React.MouseEvent) => void;
  onPanChange: (panX: number, panY: number) => void;
}

export interface LayerTreeProps {
  sections: DesignerSection[];
  seats: DesignerSeat[];
  stage: DesignerStage | null;
  aisles: DesignerAisle[];
  selectedSeatIds: Set<string>;
  selectedSectionId: string | null;
  onSectionSelect: (sectionId: string | null) => void;
  onSeatSelect: (seatId: string, multiSelect: boolean) => void;
  onToggleSectionCollapse: (sectionId: string) => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

export const DEFAULT_SEAT_WIDTH = 30;
export const DEFAULT_SEAT_HEIGHT = 30;
export const DEFAULT_GRID_SIZE = 10;
export const DEFAULT_CANVAS_WIDTH = 800;
export const DEFAULT_CANVAS_HEIGHT = 600;
export const MIN_ZOOM = 0.5;
export const MAX_ZOOM = 2;
export const MAX_HISTORY_SIZE = 50;
export const AUTO_SAVE_KEY = 'venue-designer-autosave';

export const TOOL_ICONS: Record<ToolType, string> = {
  select: '↖',
  seat: '□',
  section: '◇',
  stage: '▭',
  aisle: '╱',
};

export const TOOL_LABELS: Record<ToolType, string> = {
  select: 'Select',
  seat: 'Seat',
  section: 'Section',
  stage: 'Stage',
  aisle: 'Aisle',
};

export const DEFAULT_SECTION_COLORS = [
  '#3b82f6', // blue
  '#10b981', // green
  '#8b5cf6', // purple
  '#f59e0b', // amber
  '#ef4444', // red
  '#06b6d4', // cyan
  '#ec4899', // pink
  '#84cc16', // lime
];

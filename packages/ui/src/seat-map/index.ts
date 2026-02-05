// Main component
export { CanvasSeatMap, default as default } from './canvas-seat-map';

// Custom hooks
export { useCanvas } from './use-canvas';
export { useZoomPan } from './use-zoom-pan';

// UI components
export { SeatMapControls, SeatMapLegend, SelectionSummary } from './controls';
export { SeatTooltip } from './tooltip';

// Types
export type {
  Seat,
  SeatStatus,
  SeatShape,
  Tariff,
  Section,
  Stage,
  Aisle,
  Viewport,
  Point,
  Bounds,
  SeatColors,
  TooltipData,
  CanvasSeatMapProps,
  SpatialCell,
  SpatialIndex,
} from './types';

// Constants
export { DEFAULT_COLORS } from './types';

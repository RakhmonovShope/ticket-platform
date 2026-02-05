'use client';

import React from 'react';
import type { ToolType } from './types';
import { TOOL_LABELS, MIN_ZOOM, MAX_ZOOM } from './types';

// ============================================================================
// TOOLBAR COMPONENT
// ============================================================================

interface ToolbarProps {
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

const tools: ToolType[] = ['select', 'seat', 'section', 'stage', 'aisle'];

const toolIcons: Record<ToolType, React.ReactNode> = {
  select: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
    </svg>
  ),
  seat: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="4" y="4" width="16" height="16" rx="2" />
    </svg>
  ),
  section: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
    </svg>
  ),
  stage: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="7" width="20" height="10" rx="1" />
    </svg>
  ),
  aisle: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 20L20 4" strokeDasharray="4 2" />
    </svg>
  ),
};

export const Toolbar: React.FC<ToolbarProps> = ({
  activeTool,
  onToolChange,
  gridSnap,
  onGridSnapToggle,
  showSeatNumbers,
  onShowSeatNumbersToggle,
  showGrid,
  onShowGridToggle,
  zoom,
  onZoomChange,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onImport,
  onExport,
  onClear,
}) => {
  const buttonStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 36,
    height: 36,
    border: '1px solid #374151',
    borderRadius: 6,
    background: 'transparent',
    color: '#e5e7eb',
    cursor: 'pointer',
    transition: 'all 0.15s',
  };

  const activeButtonStyle: React.CSSProperties = {
    ...buttonStyle,
    background: '#3b82f6',
    borderColor: '#3b82f6',
    color: '#ffffff',
  };

  const toggleButtonStyle = (active: boolean): React.CSSProperties => ({
    ...buttonStyle,
    background: active ? '#1e3a5f' : 'transparent',
    borderColor: active ? '#3b82f6' : '#374151',
  });

  const disabledStyle: React.CSSProperties = {
    ...buttonStyle,
    opacity: 0.4,
    cursor: 'not-allowed',
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        padding: 12,
        background: '#1f2937',
        borderRadius: 8,
        width: 60,
      }}
    >
      {/* Tools */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', textAlign: 'center' }}>
          Tools
        </span>
        {tools.map((tool) => (
          <button
            key={tool}
            onClick={() => onToolChange(tool)}
            style={activeTool === tool ? activeButtonStyle : buttonStyle}
            title={TOOL_LABELS[tool]}
          >
            {toolIcons[tool]}
          </button>
        ))}
      </div>

      {/* Separator */}
      <div style={{ height: 1, background: '#374151' }} />

      {/* Toggle Options */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', textAlign: 'center' }}>
          View
        </span>
        <button
          onClick={onGridSnapToggle}
          style={toggleButtonStyle(gridSnap)}
          title={`Grid Snap: ${gridSnap ? 'On' : 'Off'}`}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="7" height="7" />
            <rect x="14" y="3" width="7" height="7" />
            <rect x="3" y="14" width="7" height="7" />
            <rect x="14" y="14" width="7" height="7" />
          </svg>
        </button>
        <button
          onClick={onShowGridToggle}
          style={toggleButtonStyle(showGrid)}
          title={`Show Grid: ${showGrid ? 'On' : 'Off'}`}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 3v18h18" />
            <path d="M7 3v18M11 3v18M15 3v18M19 3v18" strokeOpacity="0.5" />
            <path d="M3 7h18M3 11h18M3 15h18M3 19h18" strokeOpacity="0.5" />
          </svg>
        </button>
        <button
          onClick={onShowSeatNumbersToggle}
          style={toggleButtonStyle(showSeatNumbers)}
          title={`Show Numbers: ${showSeatNumbers ? 'On' : 'Off'}`}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <text x="5" y="18" fontSize="14" fill="currentColor">
              #
            </text>
          </svg>
        </button>
      </div>

      {/* Separator */}
      <div style={{ height: 1, background: '#374151' }} />

      {/* Zoom */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', textAlign: 'center' }}>
          Zoom
        </span>
        <button
          onClick={() => onZoomChange(Math.min(zoom + 0.1, MAX_ZOOM))}
          style={zoom >= MAX_ZOOM ? disabledStyle : buttonStyle}
          title="Zoom In"
          disabled={zoom >= MAX_ZOOM}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35M8 11h6M11 8v6" />
          </svg>
        </button>
        <div
          style={{
            fontSize: 11,
            color: '#9ca3af',
            textAlign: 'center',
            padding: '4px 0',
          }}
        >
          {Math.round(zoom * 100)}%
        </div>
        <button
          onClick={() => onZoomChange(Math.max(zoom - 0.1, MIN_ZOOM))}
          style={zoom <= MIN_ZOOM ? disabledStyle : buttonStyle}
          title="Zoom Out"
          disabled={zoom <= MIN_ZOOM}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35M8 11h6" />
          </svg>
        </button>
      </div>

      {/* Separator */}
      <div style={{ height: 1, background: '#374151' }} />

      {/* History */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', textAlign: 'center' }}>
          Edit
        </span>
        <button
          onClick={onUndo}
          style={canUndo ? buttonStyle : disabledStyle}
          title="Undo (Ctrl+Z)"
          disabled={!canUndo}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 7v6h6" />
            <path d="M3 13a9 9 0 1 0 2.64-6.36L3 9" />
          </svg>
        </button>
        <button
          onClick={onRedo}
          style={canRedo ? buttonStyle : disabledStyle}
          title="Redo (Ctrl+Y)"
          disabled={!canRedo}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 7v6h-6" />
            <path d="M21 13a9 9 0 1 1-2.64-6.36L21 9" />
          </svg>
        </button>
      </div>

      {/* Separator */}
      <div style={{ height: 1, background: '#374151' }} />

      {/* File Operations */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', textAlign: 'center' }}>
          File
        </span>
        <button onClick={onImport} style={buttonStyle} title="Import JSON">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        </button>
        <button onClick={onExport} style={buttonStyle} title="Export JSON">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
        </button>
        <button
          onClick={onClear}
          style={{ ...buttonStyle, color: '#ef4444' }}
          title="Clear All"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default Toolbar;

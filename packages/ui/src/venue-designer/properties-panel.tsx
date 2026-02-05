'use client';

import React, { useState } from 'react';
import type { DesignerSeat, DesignerSection, DesignerStage, SeatShape } from './types';
import { DEFAULT_SECTION_COLORS } from './types';

// ============================================================================
// PROPERTIES PANEL COMPONENT
// ============================================================================

interface PropertiesPanelProps {
  selectedSeats: DesignerSeat[];
  selectedSection: DesignerSection | null;
  stage: DesignerStage | null;
  onSeatChange: (updates: Partial<DesignerSeat>) => void;
  onSectionChange: (id: string, updates: Partial<DesignerSection>) => void;
  onStageChange: (updates: Partial<DesignerStage>) => void;
  onCreateSection: (name: string) => void;
  onDeleteSelected: () => void;
  onDuplicateSelected: () => void;
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '6px 10px',
  background: '#374151',
  border: '1px solid #4b5563',
  borderRadius: 4,
  color: '#e5e7eb',
  fontSize: 13,
  outline: 'none',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  color: '#9ca3af',
  marginBottom: 4,
  textTransform: 'uppercase',
};

const fieldStyle: React.CSSProperties = {
  marginBottom: 12,
};

const buttonStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  background: '#3b82f6',
  border: 'none',
  borderRadius: 6,
  color: '#ffffff',
  fontSize: 13,
  fontWeight: 500,
  cursor: 'pointer',
  transition: 'background 0.15s',
};

const dangerButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  background: '#ef4444',
};

export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({
  selectedSeats,
  selectedSection,
  stage,
  onSeatChange,
  onSectionChange,
  onStageChange,
  onCreateSection,
  onDeleteSelected,
  onDuplicateSelected,
}) => {
  const [newSectionName, setNewSectionName] = useState('');

  const hasSelection = selectedSeats.length > 0;
  const singleSeat = selectedSeats.length === 1 ? selectedSeats[0] : null;

  // Get common values for multi-select
  const commonValues = selectedSeats.length > 0
    ? {
        row: selectedSeats.every((s) => s.row === selectedSeats[0].row) ? selectedSeats[0].row : '',
        section: selectedSeats.every((s) => s.section === selectedSeats[0].section) ? selectedSeats[0].section : '',
        shape: selectedSeats.every((s) => s.shape === selectedSeats[0].shape) ? selectedSeats[0].shape : null,
        rotation: selectedSeats.every((s) => s.rotation === selectedSeats[0].rotation) ? selectedSeats[0].rotation : null,
      }
    : null;

  return (
    <div
      style={{
        padding: 16,
        background: '#1f2937',
        borderRadius: 8,
        width: 240,
        maxHeight: '100%',
        overflowY: 'auto',
      }}
    >
      <h3 style={{ margin: '0 0 16px', fontSize: 14, color: '#e5e7eb' }}>Properties</h3>

      {/* No Selection */}
      {!hasSelection && !selectedSection && !stage && (
        <p style={{ color: '#6b7280', fontSize: 13 }}>Select items to edit their properties.</p>
      )}

      {/* Seat Properties */}
      {hasSelection && (
        <div style={{ marginBottom: 20 }}>
          <h4 style={{ margin: '0 0 12px', fontSize: 12, color: '#9ca3af', textTransform: 'uppercase' }}>
            {selectedSeats.length === 1 ? 'Seat' : `${selectedSeats.length} Seats`}
          </h4>

          {/* Row */}
          <div style={fieldStyle}>
            <label style={labelStyle}>Row</label>
            <input
              type="text"
              value={singleSeat?.row ?? commonValues?.row ?? ''}
              onChange={(e) => onSeatChange({ row: e.target.value.toUpperCase() })}
              style={inputStyle}
              placeholder={commonValues?.row === '' ? 'Mixed' : ''}
            />
          </div>

          {/* Number (only for single seat) */}
          {singleSeat && (
            <div style={fieldStyle}>
              <label style={labelStyle}>Number</label>
              <input
                type="text"
                value={singleSeat.number}
                onChange={(e) => onSeatChange({ number: e.target.value })}
                style={inputStyle}
              />
            </div>
          )}

          {/* Section */}
          <div style={fieldStyle}>
            <label style={labelStyle}>Section</label>
            <input
              type="text"
              value={singleSeat?.section ?? commonValues?.section ?? ''}
              onChange={(e) => onSeatChange({ section: e.target.value })}
              style={inputStyle}
              placeholder={commonValues?.section === '' ? 'Mixed' : ''}
            />
          </div>

          {/* Shape */}
          <div style={fieldStyle}>
            <label style={labelStyle}>Shape</label>
            <select
              value={singleSeat?.shape ?? commonValues?.shape ?? ''}
              onChange={(e) => onSeatChange({ shape: e.target.value as SeatShape })}
              style={inputStyle}
            >
              {commonValues?.shape === null && <option value="">Mixed</option>}
              <option value="RECTANGLE">Rectangle</option>
              <option value="CIRCLE">Circle</option>
            </select>
          </div>

          {/* Rotation */}
          <div style={fieldStyle}>
            <label style={labelStyle}>Rotation ({singleSeat?.rotation ?? commonValues?.rotation ?? 0}°)</label>
            <input
              type="range"
              min="0"
              max="360"
              step="15"
              value={singleSeat?.rotation ?? commonValues?.rotation ?? 0}
              onChange={(e) => onSeatChange({ rotation: parseInt(e.target.value, 10) })}
              style={{ width: '100%' }}
            />
          </div>

          {/* Position (single seat only) */}
          {singleSeat && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>X</label>
                <input
                  type="number"
                  value={Math.round(singleSeat.x)}
                  onChange={(e) => onSeatChange({ x: parseFloat(e.target.value) })}
                  style={inputStyle}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Y</label>
                <input
                  type="number"
                  value={Math.round(singleSeat.y)}
                  onChange={(e) => onSeatChange({ y: parseFloat(e.target.value) })}
                  style={inputStyle}
                />
              </div>
            </div>
          )}

          {/* Size */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Width</label>
              <input
                type="number"
                value={singleSeat?.width ?? 30}
                onChange={(e) => onSeatChange({ width: parseFloat(e.target.value) })}
                style={inputStyle}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Height</label>
              <input
                type="number"
                value={singleSeat?.height ?? 30}
                onChange={(e) => onSeatChange({ height: parseFloat(e.target.value) })}
                style={inputStyle}
              />
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
            <button onClick={onDuplicateSelected} style={buttonStyle}>
              Duplicate (Ctrl+D)
            </button>
            <button onClick={onDeleteSelected} style={dangerButtonStyle}>
              Delete (Del)
            </button>
          </div>

          {/* Create Section */}
          <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #374151' }}>
            <label style={labelStyle}>Create Section from Selection</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                value={newSectionName}
                onChange={(e) => setNewSectionName(e.target.value)}
                placeholder="Section name"
                style={{ ...inputStyle, flex: 1 }}
              />
              <button
                onClick={() => {
                  if (newSectionName.trim()) {
                    onCreateSection(newSectionName.trim());
                    setNewSectionName('');
                  }
                }}
                style={{
                  ...buttonStyle,
                  width: 'auto',
                  padding: '6px 12px',
                  background: '#10b981',
                }}
                disabled={!newSectionName.trim()}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Section Properties */}
      {selectedSection && (
        <div style={{ marginBottom: 20 }}>
          <h4 style={{ margin: '0 0 12px', fontSize: 12, color: '#9ca3af', textTransform: 'uppercase' }}>
            Section
          </h4>

          <div style={fieldStyle}>
            <label style={labelStyle}>Name</label>
            <input
              type="text"
              value={selectedSection.name}
              onChange={(e) => onSectionChange(selectedSection.id, { name: e.target.value })}
              style={inputStyle}
            />
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>Color</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {DEFAULT_SECTION_COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => onSectionChange(selectedSection.id, { color })}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 4,
                    background: color,
                    border: selectedSection.color === color ? '2px solid white' : '2px solid transparent',
                    cursor: 'pointer',
                  }}
                />
              ))}
            </div>
          </div>

          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 8 }}>
            {selectedSection.seatIds.length} seats in this section
          </div>
        </div>
      )}

      {/* Stage Properties */}
      {stage && (
        <div>
          <h4 style={{ margin: '0 0 12px', fontSize: 12, color: '#9ca3af', textTransform: 'uppercase' }}>
            Stage
          </h4>

          <div style={fieldStyle}>
            <label style={labelStyle}>Label</label>
            <input
              type="text"
              value={stage.label}
              onChange={(e) => onStageChange({ label: e.target.value })}
              style={inputStyle}
            />
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>X</label>
              <input
                type="number"
                value={Math.round(stage.x)}
                onChange={(e) => onStageChange({ x: parseFloat(e.target.value) })}
                style={inputStyle}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Y</label>
              <input
                type="number"
                value={Math.round(stage.y)}
                onChange={(e) => onStageChange({ y: parseFloat(e.target.value) })}
                style={inputStyle}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Width</label>
              <input
                type="number"
                value={Math.round(stage.width)}
                onChange={(e) => onStageChange({ width: parseFloat(e.target.value) })}
                style={inputStyle}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Height</label>
              <input
                type="number"
                value={Math.round(stage.height)}
                onChange={(e) => onStageChange({ height: parseFloat(e.target.value) })}
                style={inputStyle}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PropertiesPanel;

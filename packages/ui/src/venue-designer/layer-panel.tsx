'use client';

import React, { useState, useMemo } from 'react';
import type { DesignerSeat, DesignerSection, DesignerStage, DesignerAisle } from './types';

// ============================================================================
// LAYER PANEL COMPONENT
// ============================================================================

interface LayerPanelProps {
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

export const LayerPanel: React.FC<LayerPanelProps> = ({
  sections,
  seats,
  stage,
  aisles,
  selectedSeatIds,
  selectedSectionId,
  onSectionSelect,
  onSeatSelect,
}) => {
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'layers' | 'seats'>('layers');
  const [searchQuery, setSearchQuery] = useState('');

  // Group seats by section
  const seatsBySection = useMemo(() => {
    const grouped = new Map<string, DesignerSeat[]>();

    for (const seat of seats) {
      const sectionName = seat.section || 'Ungrouped';
      if (!grouped.has(sectionName)) {
        grouped.set(sectionName, []);
      }
      grouped.get(sectionName)!.push(seat);
    }

    return grouped;
  }, [seats]);

  // Filter seats by search
  const filteredSeats = useMemo(() => {
    if (!searchQuery) return seats;
    const query = searchQuery.toLowerCase();
    return seats.filter(
      (seat) =>
        seat.row.toLowerCase().includes(query) ||
        seat.number.toLowerCase().includes(query) ||
        seat.section.toLowerCase().includes(query) ||
        `${seat.row}${seat.number}`.toLowerCase().includes(query)
    );
  }, [seats, searchQuery]);

  const toggleSection = (sectionId: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };

  const itemStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 8px',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: 13,
    color: '#e5e7eb',
    transition: 'background 0.1s',
  };

  const selectedItemStyle: React.CSSProperties = {
    ...itemStyle,
    background: '#3b82f6',
  };

  const tabStyle = (active: boolean): React.CSSProperties => ({
    flex: 1,
    padding: '8px 12px',
    border: 'none',
    background: active ? '#374151' : 'transparent',
    color: active ? '#ffffff' : '#9ca3af',
    fontSize: 12,
    fontWeight: 500,
    cursor: 'pointer',
    borderRadius: 4,
    transition: 'all 0.15s',
  });

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        background: '#1f2937',
        borderRadius: 8,
        width: 240,
        maxHeight: '100%',
        overflow: 'hidden',
      }}
    >
      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, padding: 8, borderBottom: '1px solid #374151' }}>
        <button style={tabStyle(activeTab === 'layers')} onClick={() => setActiveTab('layers')}>
          Layers
        </button>
        <button style={tabStyle(activeTab === 'seats')} onClick={() => setActiveTab('seats')}>
          Seats ({seats.length})
        </button>
      </div>

      {/* Search (seats tab only) */}
      {activeTab === 'seats' && (
        <div style={{ padding: 8, borderBottom: '1px solid #374151' }}>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search seats..."
            style={{
              width: '100%',
              padding: '6px 10px',
              background: '#374151',
              border: '1px solid #4b5563',
              borderRadius: 4,
              color: '#e5e7eb',
              fontSize: 12,
              outline: 'none',
            }}
          />
        </div>
      )}

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: 8 }}>
        {activeTab === 'layers' ? (
          <div>
            {/* Stage */}
            {stage && (
              <div style={itemStyle}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="7" width="20" height="10" rx="1" />
                </svg>
                <span>Stage</span>
              </div>
            )}

            {/* Aisles */}
            {aisles.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 8px',
                    fontSize: 11,
                    color: '#9ca3af',
                    textTransform: 'uppercase',
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 20L20 4" strokeDasharray="4 2" />
                  </svg>
                  Aisles ({aisles.length})
                </div>
              </div>
            )}

            {/* Sections */}
            {sections.map((section) => {
              const sectionSeats = seatsBySection.get(section.name) || [];
              const isCollapsed = collapsedSections.has(section.id);
              const isSelected = selectedSectionId === section.id;

              return (
                <div key={section.id} style={{ marginTop: 8 }}>
                  <div
                    style={{
                      ...itemStyle,
                      background: isSelected ? 'rgba(59, 130, 246, 0.2)' : undefined,
                    }}
                    onClick={() => onSectionSelect(isSelected ? null : section.id)}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSection(section.id);
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        color: 'inherit',
                        cursor: 'pointer',
                      }}
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        style={{ transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}
                      >
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </button>
                    <div
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: 2,
                        background: section.color,
                      }}
                    />
                    <span style={{ flex: 1 }}>{section.name}</span>
                    <span style={{ fontSize: 11, color: '#6b7280' }}>{section.seatIds.length}</span>
                  </div>

                  {/* Section seats */}
                  {!isCollapsed && (
                    <div style={{ marginLeft: 20 }}>
                      {sectionSeats.slice(0, 10).map((seat) => (
                        <div
                          key={seat.id}
                          style={{
                            ...(selectedSeatIds.has(seat.id) ? selectedItemStyle : itemStyle),
                            padding: '4px 8px',
                            fontSize: 12,
                          }}
                          onClick={(e) => onSeatSelect(seat.id, e.shiftKey)}
                        >
                          <span>
                            Row {seat.row}, Seat {seat.number}
                          </span>
                        </div>
                      ))}
                      {sectionSeats.length > 10 && (
                        <div style={{ padding: '4px 8px', fontSize: 11, color: '#6b7280' }}>
                          +{sectionSeats.length - 10} more seats
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Ungrouped seats */}
            {seats.filter((s) => !sections.some((sec) => sec.seatIds.includes(s.id))).length > 0 && (
              <div style={{ marginTop: 8 }}>
                <div
                  style={{
                    ...itemStyle,
                    cursor: 'default',
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="4" y="4" width="16" height="16" rx="2" />
                  </svg>
                  <span style={{ flex: 1, color: '#9ca3af' }}>Ungrouped</span>
                  <span style={{ fontSize: 11, color: '#6b7280' }}>
                    {seats.filter((s) => !sections.some((sec) => sec.seatIds.includes(s.id))).length}
                  </span>
                </div>
              </div>
            )}
          </div>
        ) : (
          // Seats list
          <div>
            {filteredSeats.length === 0 ? (
              <p style={{ color: '#6b7280', fontSize: 13, textAlign: 'center', padding: 20 }}>
                {searchQuery ? 'No seats found' : 'No seats added yet'}
              </p>
            ) : (
              filteredSeats.map((seat) => (
                <div
                  key={seat.id}
                  style={selectedSeatIds.has(seat.id) ? selectedItemStyle : itemStyle}
                  onClick={(e) => onSeatSelect(seat.id, e.shiftKey)}
                >
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: seat.shape === 'CIRCLE' ? '50%' : 2,
                      background: sections.find((s) => s.seatIds.includes(seat.id))?.color || '#3b82f6',
                    }}
                  />
                  <span style={{ flex: 1 }}>
                    {seat.row}-{seat.number}
                  </span>
                  <span style={{ fontSize: 11, color: '#6b7280' }}>{seat.section}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Summary */}
      <div
        style={{
          padding: 12,
          borderTop: '1px solid #374151',
          background: '#111827',
          fontSize: 11,
          color: '#9ca3af',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span>Total Seats:</span>
          <span style={{ color: '#e5e7eb' }}>{seats.length}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span>Sections:</span>
          <span style={{ color: '#e5e7eb' }}>{sections.length}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Selected:</span>
          <span style={{ color: '#3b82f6' }}>{selectedSeatIds.size}</span>
        </div>
      </div>
    </div>
  );
};

export default LayerPanel;

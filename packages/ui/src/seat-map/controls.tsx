'use client';

import React from 'react';
import type { Tariff, SeatStatus } from './types';
import { DEFAULT_COLORS } from './types';

// ============================================================================
// ZOOM CONTROLS
// ============================================================================

interface SeatMapControlsProps {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  minZoom: number;
  maxZoom: number;
}

export const SeatMapControls: React.FC<SeatMapControlsProps> = ({
  zoom,
  onZoomIn,
  onZoomOut,
  onReset,
  minZoom,
  maxZoom,
}) => {
  const buttonStyle: React.CSSProperties = {
    width: 36,
    height: 36,
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 18,
    fontWeight: 'bold',
    transition: 'background-color 0.2s',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    color: '#ffffff',
  };

  const disabledStyle: React.CSSProperties = {
    ...buttonStyle,
    opacity: 0.5,
    cursor: 'not-allowed',
  };

  const canZoomIn = zoom < maxZoom;
  const canZoomOut = zoom > minZoom;
  const canReset = zoom !== 1;

  return (
    <div
      style={{
        position: 'absolute',
        top: 12,
        right: 12,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        borderRadius: 10,
        padding: 6,
        backdropFilter: 'blur(8px)',
      }}
    >
      <button
        onClick={onZoomIn}
        disabled={!canZoomIn}
        style={canZoomIn ? buttonStyle : disabledStyle}
        title="Zoom In"
        aria-label="Zoom In"
      >
        +
      </button>
      <button
        onClick={onZoomOut}
        disabled={!canZoomOut}
        style={canZoomOut ? buttonStyle : disabledStyle}
        title="Zoom Out"
        aria-label="Zoom Out"
      >
        −
      </button>
      <button
        onClick={onReset}
        disabled={!canReset}
        style={canReset ? buttonStyle : disabledStyle}
        title="Reset View"
        aria-label="Reset View"
      >
        ⟲
      </button>
    </div>
  );
};

// ============================================================================
// LEGEND
// ============================================================================

interface LegendItem {
  label: string;
  color: string;
}

interface SeatMapLegendProps {
  statuses?: Array<{ status: SeatStatus; label: string }>;
  tariffs?: Tariff[];
  showSelected?: boolean;
  className?: string;
}

const DEFAULT_STATUS_LEGEND: Array<{ status: SeatStatus; label: string }> = [
  { status: 'AVAILABLE', label: 'Available' },
  { status: 'RESERVED', label: 'Reserved' },
  { status: 'DISABLED', label: 'Unavailable' },
];

export const SeatMapLegend: React.FC<SeatMapLegendProps> = ({
  statuses = DEFAULT_STATUS_LEGEND,
  tariffs,
  showSelected = true,
  className,
}) => {
  const legendItems: LegendItem[] = [];

  // Add tariff colors (for available seats)
  if (tariffs && tariffs.length > 0) {
    for (const tariff of tariffs) {
      legendItems.push({
        label: `${tariff.name} ($${tariff.price})`,
        color: tariff.color,
      });
    }
  } else {
    // Add available status color only if no tariffs
    const availableStatus = statuses.find((s) => s.status === 'AVAILABLE');
    if (availableStatus) {
      legendItems.push({
        label: availableStatus.label,
        color: DEFAULT_COLORS.AVAILABLE,
      });
    }
  }

  // Add selected
  if (showSelected) {
    legendItems.push({
      label: 'Selected',
      color: DEFAULT_COLORS.selected,
    });
  }

  // Add other statuses (reserved, disabled)
  for (const { status, label } of statuses) {
    if (status === 'AVAILABLE' || status === 'HIDDEN') continue;
    legendItems.push({
      label,
      color: DEFAULT_COLORS[status],
    });
  }

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 16,
        padding: 12,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        borderRadius: 8,
        backdropFilter: 'blur(8px)',
      }}
    >
      {legendItems.map((item) => (
        <div
          key={item.label}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <div
            style={{
              width: 16,
              height: 16,
              backgroundColor: item.color,
              borderRadius: 4,
              border: '1px solid rgba(255, 255, 255, 0.3)',
            }}
          />
          <span style={{ color: '#ffffff', fontSize: 14 }}>{item.label}</span>
        </div>
      ))}
    </div>
  );
};

// ============================================================================
// SELECTION SUMMARY
// ============================================================================

interface SelectionSummaryProps {
  selectedCount: number;
  totalPrice: number;
  currency?: string;
  onProceed?: () => void;
  onClear?: () => void;
  className?: string;
}

export const SelectionSummary: React.FC<SelectionSummaryProps> = ({
  selectedCount,
  totalPrice,
  currency = 'USD',
  onProceed,
  onClear,
  className,
}) => {
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(price);
  };

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        borderRadius: 12,
        backdropFilter: 'blur(8px)',
        gap: 24,
      }}
    >
      <div style={{ display: 'flex', gap: 24 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: '#94a3b8', fontSize: 12, marginBottom: 4 }}>
            Seats
          </div>
          <div style={{ color: '#ffffff', fontSize: 24, fontWeight: 'bold' }}>
            {selectedCount}
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: '#94a3b8', fontSize: 12, marginBottom: 4 }}>
            Total
          </div>
          <div style={{ color: '#10b981', fontSize: 24, fontWeight: 'bold' }}>
            {formatPrice(totalPrice)}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        {onClear && selectedCount > 0 && (
          <button
            onClick={onClear}
            style={{
              padding: '10px 20px',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: 8,
              backgroundColor: 'transparent',
              color: '#ffffff',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            Clear
          </button>
        )}
        {onProceed && (
          <button
            onClick={onProceed}
            disabled={selectedCount === 0}
            style={{
              padding: '10px 24px',
              border: 'none',
              borderRadius: 8,
              backgroundColor: selectedCount > 0 ? '#10b981' : '#374151',
              color: '#ffffff',
              cursor: selectedCount > 0 ? 'pointer' : 'not-allowed',
              fontSize: 14,
              fontWeight: 600,
              transition: 'background-color 0.2s',
            }}
          >
            Proceed
          </button>
        )}
      </div>
    </div>
  );
};

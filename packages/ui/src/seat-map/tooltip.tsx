'use client';

import React from 'react';
import type { Seat, SeatStatus } from './types';
import { DEFAULT_COLORS } from './types';

interface SeatTooltipProps {
  seat: Seat;
  x: number;
  y: number;
  isSelected: boolean;
}

const statusConfig: Record<SeatStatus, { label: string; color: string }> = {
  AVAILABLE: { label: 'Available', color: '#10b981' },
  RESERVED: { label: 'Reserved', color: '#ef4444' },
  OCCUPIED: { label: 'Occupied', color: '#ef4444' },
  DISABLED: { label: 'Unavailable', color: '#9ca3af' },
  HIDDEN: { label: 'Hidden', color: '#374151' },
};

export const SeatTooltip: React.FC<SeatTooltipProps> = ({
  seat,
  x,
  y,
  isSelected,
}) => {
  const { label, color } = statusConfig[seat.status];

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        transform: 'translate(-50%, -100%)',
        padding: '10px 14px',
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: 10,
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.4)',
        pointerEvents: 'none',
        zIndex: 100,
        whiteSpace: 'nowrap',
        minWidth: 120,
      }}
    >
      {/* Arrow */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          bottom: -6,
          transform: 'translateX(-50%)',
          width: 0,
          height: 0,
          borderLeft: '6px solid transparent',
          borderRight: '6px solid transparent',
          borderTop: '6px solid rgba(15, 23, 42, 0.95)',
        }}
      />

      {/* Section & Row/Number */}
      <div style={{ marginBottom: 6 }}>
        <span style={{ color: '#94a3b8', fontSize: 12 }}>{seat.section}</span>
        <div style={{ color: '#ffffff', fontSize: 16, fontWeight: 600 }}>
          Row {seat.row}, Seat {seat.number}
        </div>
      </div>

      {/* Status */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          marginBottom: seat.tariff ? 6 : 0,
        }}
      >
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            backgroundColor: isSelected ? DEFAULT_COLORS.selected : color,
          }}
        />
        <span style={{ color: '#e2e8f0', fontSize: 13 }}>
          {isSelected ? 'Selected' : label}
        </span>
      </div>

      {/* Tariff Info */}
      {seat.tariff && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: 6,
            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
            marginTop: 4,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: 2,
                backgroundColor: seat.tariff.color,
              }}
            />
            <span style={{ color: '#94a3b8', fontSize: 12 }}>
              {seat.tariff.name}
            </span>
          </div>
          <span style={{ color: '#10b981', fontSize: 14, fontWeight: 600 }}>
            ${seat.tariff.price}
          </span>
        </div>
      )}
    </div>
  );
};

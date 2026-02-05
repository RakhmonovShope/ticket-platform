'use client';

import React, { useState, useCallback } from 'react';
import { CanvasSeatMap } from './canvas-seat-map';
import { SeatMapLegend, SelectionSummary } from './controls';
import type { Seat, Tariff, Stage, Aisle, SeatStatus, SeatShape } from './types';

// ============================================================================
// SAMPLE DATA
// ============================================================================

const TARIFFS: Tariff[] = [
  { id: 't1', name: 'VIP', price: 150, color: '#eab308' },      // gold
  { id: 't2', name: 'Premium', price: 100, color: '#8b5cf6' },  // purple
  { id: 't3', name: 'Standard', price: 50, color: '#3b82f6' },  // blue
];

const STAGE: Stage = {
  x: 100,
  y: 20,
  width: 600,
  height: 80,
  label: 'STAGE',
};

const AISLES: Aisle[] = [
  {
    id: 'aisle-left',
    points: [
      { x: 90, y: 120 },
      { x: 90, y: 500 },
    ],
  },
  {
    id: 'aisle-right',
    points: [
      { x: 710, y: 120 },
      { x: 710, y: 500 },
    ],
  },
  {
    id: 'aisle-center',
    points: [
      { x: 400, y: 300 },
      { x: 400, y: 500 },
    ],
  },
];

function generateSampleSeats(): Seat[] {
  const seats: Seat[] = [];
  const rows = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
  const seatsPerRow = 14;
  const seatWidth = 36;
  const seatHeight = 36;
  const rowSpacing = 44;
  const seatSpacing = 42;
  const startX = 110;
  const startY = 130;

  const statuses: SeatStatus[] = ['AVAILABLE', 'RESERVED', 'OCCUPIED', 'DISABLED'];

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex];
    const y = startY + rowIndex * rowSpacing;

    // Determine tariff based on row
    let tariff: Tariff;
    if (rowIndex < 2) {
      tariff = TARIFFS[0]; // VIP
    } else if (rowIndex < 5) {
      tariff = TARIFFS[1]; // Premium
    } else {
      tariff = TARIFFS[2]; // Standard
    }

    for (let seatIndex = 0; seatIndex < seatsPerRow; seatIndex++) {
      // Add gap in center for aisle
      const xOffset = seatIndex >= seatsPerRow / 2 ? 20 : 0;
      const x = startX + seatIndex * seatSpacing + xOffset;

      // Generate random status (mostly available)
      const random = Math.random();
      let status: SeatStatus;
      if (random < 0.75) {
        status = 'AVAILABLE';
      } else if (random < 0.85) {
        status = 'RESERVED';
      } else if (random < 0.92) {
        status = 'OCCUPIED';
      } else {
        status = 'DISABLED';
      }

      // Shape: alternate between rectangle and circle
      const shape: SeatShape = rowIndex % 2 === 0 ? 'RECTANGLE' : 'CIRCLE';

      seats.push({
        id: `${row}-${seatIndex + 1}`,
        row,
        number: String(seatIndex + 1),
        section: rowIndex < 2 ? 'VIP' : rowIndex < 5 ? 'Premium' : 'Standard',
        x,
        y,
        width: seatWidth,
        height: seatHeight,
        shape,
        rotation: 0,
        status,
        tariff: status !== 'DISABLED' ? tariff : undefined,
      });
    }
  }

  return seats;
}

// ============================================================================
// EXAMPLE COMPONENT
// ============================================================================

export const SeatMapExample: React.FC = () => {
  const [seats] = useState<Seat[]>(() => generateSampleSeats());
  const [selectedSeats, setSelectedSeats] = useState<string[]>([]);

  const handleSeatClick = useCallback((seat: Seat) => {
    setSelectedSeats((prev) => {
      if (prev.includes(seat.id)) {
        return prev.filter((id) => id !== seat.id);
      }
      return [...prev, seat.id];
    });
  }, []);

  const handleSeatHover = useCallback((seat: Seat | null) => {
    // Could add hover state handling here
    if (seat) {
      console.log('Hovering:', seat.row, seat.number);
    }
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedSeats([]);
  }, []);

  const handleProceed = useCallback(() => {
    const selectedSeatObjects = seats.filter((s) => selectedSeats.includes(s.id));
    alert(`Proceeding with ${selectedSeatObjects.length} seats:\n${
      selectedSeatObjects.map((s) => `Row ${s.row}, Seat ${s.number}`).join('\n')
    }`);
  }, [seats, selectedSeats]);

  // Calculate total price
  const totalPrice = selectedSeats.reduce((sum, seatId) => {
    const seat = seats.find((s) => s.id === seatId);
    return sum + (seat?.tariff?.price ?? 0);
  }, 0);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        padding: 20,
        backgroundColor: '#0f172a',
        minHeight: '100vh',
      }}
    >
      <h1 style={{ color: '#ffffff', margin: 0 }}>Interactive Seat Map</h1>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <SeatMapLegend tariffs={TARIFFS} showSelected />
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 600,
          borderRadius: 12,
          overflow: 'hidden',
          border: '1px solid rgba(255, 255, 255, 0.1)',
        }}
      >
        <CanvasSeatMap
          width={800}
          height={600}
          seats={seats}
          selectedSeats={selectedSeats}
          onSeatClick={handleSeatClick}
          onSeatHover={handleSeatHover}
          stage={STAGE}
          aisles={AISLES}
          showTooltip
          minZoom={0.5}
          maxZoom={3}
        />
      </div>

      <SelectionSummary
        selectedCount={selectedSeats.length}
        totalPrice={totalPrice}
        onClear={handleClearSelection}
        onProceed={handleProceed}
      />
    </div>
  );
};

export default SeatMapExample;

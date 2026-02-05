import React, { useState, useCallback } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { CanvasSeatMap } from './canvas-seat-map';
import { SeatMapLegend, SelectionSummary } from './controls';
import type { Seat, Tariff, Stage, Aisle, SeatStatus, SeatShape } from './types';

// ============================================================================
// METADATA
// ============================================================================

const meta: Meta<typeof CanvasSeatMap> = {
  title: 'Components/CanvasSeatMap',
  component: CanvasSeatMap,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'An interactive seat map component using HTML5 Canvas with zoom, pan, and seat selection capabilities.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    width: {
      control: { type: 'number', min: 400, max: 1600 },
      description: 'Canvas width in pixels',
    },
    height: {
      control: { type: 'number', min: 300, max: 1200 },
      description: 'Canvas height in pixels',
    },
    minZoom: {
      control: { type: 'number', min: 0.1, max: 1 },
      description: 'Minimum zoom level',
    },
    maxZoom: {
      control: { type: 'number', min: 1, max: 10 },
      description: 'Maximum zoom level',
    },
    readOnly: {
      control: 'boolean',
      description: 'Disable all interactions',
    },
    showTooltip: {
      control: 'boolean',
      description: 'Show tooltip on seat hover',
    },
    backgroundColor: {
      control: 'color',
      description: 'Canvas background color',
    },
  },
};

export default meta;
type Story = StoryObj<typeof CanvasSeatMap>;

// ============================================================================
// SAMPLE DATA GENERATORS
// ============================================================================

const TARIFFS: Tariff[] = [
  { id: 't1', name: 'VIP', price: 150, color: '#eab308' },
  { id: 't2', name: 'Premium', price: 100, color: '#8b5cf6' },
  { id: 't3', name: 'Standard', price: 50, color: '#3b82f6' },
];

function generateTheaterSeats(): {
  seats: Seat[];
  stage: Stage;
  aisles: Aisle[];
} {
  const seats: Seat[] = [];
  const rows = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
  const startX = 120;
  const startY = 150;
  const seatSize = 34;
  const spacing = 40;

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex];
    const y = startY + rowIndex * spacing;
    const seatsInRow = 12 + (rowIndex % 2);
    const tariff = rowIndex < 2 ? TARIFFS[0] : rowIndex < 5 ? TARIFFS[1] : TARIFFS[2];

    for (let seatIndex = 0; seatIndex < seatsInRow; seatIndex++) {
      const xOffset = seatIndex >= seatsInRow / 2 ? 30 : 0;
      const x = startX + seatIndex * spacing + xOffset;
      const random = Math.random();
      const status: SeatStatus =
        random < 0.8 ? 'AVAILABLE' : random < 0.9 ? 'RESERVED' : 'OCCUPIED';

      seats.push({
        id: `${row}-${seatIndex + 1}`,
        row,
        number: String(seatIndex + 1),
        section: tariff.name,
        x,
        y,
        width: seatSize,
        height: seatSize,
        shape: 'RECTANGLE',
        rotation: 0,
        status,
        tariff,
      });
    }
  }

  return {
    seats,
    stage: {
      x: 100,
      y: 30,
      width: 600,
      height: 80,
      label: 'STAGE',
    },
    aisles: [
      { id: 'left', points: [{ x: 100, y: 140 }, { x: 100, y: 500 }] },
      { id: 'right', points: [{ x: 700, y: 140 }, { x: 700, y: 500 }] },
      { id: 'center', points: [{ x: 400, y: 300 }, { x: 400, y: 500 }] },
    ],
  };
}

function generateStadiumSeats(): {
  seats: Seat[];
  stage: Stage;
} {
  const seats: Seat[] = [];
  const sections = [
    { name: 'North', startAngle: -30, endAngle: 30, rows: 6, radius: 200 },
    { name: 'East', startAngle: 60, endAngle: 120, rows: 6, radius: 200 },
    { name: 'South', startAngle: 150, endAngle: 210, rows: 6, radius: 200 },
    { name: 'West', startAngle: 240, endAngle: 300, rows: 6, radius: 200 },
  ];

  const centerX = 400;
  const centerY = 300;

  sections.forEach((section, sectionIndex) => {
    const angleStep = (section.endAngle - section.startAngle) / 10;

    for (let rowIndex = 0; rowIndex < section.rows; rowIndex++) {
      const currentRadius = section.radius + rowIndex * 35;
      const row = String.fromCharCode(65 + rowIndex);
      const tariff = rowIndex < 2 ? TARIFFS[0] : rowIndex < 4 ? TARIFFS[1] : TARIFFS[2];

      for (let seatIndex = 0; seatIndex <= 10; seatIndex++) {
        const angle = ((section.startAngle + seatIndex * angleStep) * Math.PI) / 180;
        const x = centerX + Math.cos(angle) * currentRadius;
        const y = centerY + Math.sin(angle) * currentRadius;
        const rotation = ((section.startAngle + seatIndex * angleStep) + 90) % 360;

        const random = Math.random();
        const status: SeatStatus =
          random < 0.85 ? 'AVAILABLE' : random < 0.95 ? 'RESERVED' : 'OCCUPIED';

        seats.push({
          id: `${section.name}-${row}-${seatIndex + 1}`,
          row,
          number: String(seatIndex + 1),
          section: section.name,
          x: x - 15,
          y: y - 15,
          width: 30,
          height: 30,
          shape: 'CIRCLE',
          rotation,
          status,
          tariff,
        });
      }
    }
  });

  return {
    seats,
    stage: {
      x: 350,
      y: 250,
      width: 100,
      height: 100,
      label: 'FIELD',
    },
  };
}

function generateLargeVenue(): Seat[] {
  const seats: Seat[] = [];
  const rows = 50;
  const seatsPerRow = 40;
  const seatSize = 20;
  const spacing = 24;
  const startX = 50;
  const startY = 100;

  for (let rowIndex = 0; rowIndex < rows; rowIndex++) {
    const row = String(rowIndex + 1).padStart(2, '0');
    const y = startY + rowIndex * spacing;
    const tariff = TARIFFS[Math.floor(rowIndex / 17)] || TARIFFS[2];

    for (let seatIndex = 0; seatIndex < seatsPerRow; seatIndex++) {
      const x = startX + seatIndex * spacing;
      const random = Math.random();
      const status: SeatStatus =
        random < 0.9 ? 'AVAILABLE' : random < 0.95 ? 'RESERVED' : 'OCCUPIED';

      seats.push({
        id: `R${row}-S${seatIndex + 1}`,
        row,
        number: String(seatIndex + 1),
        section: 'Main',
        x,
        y,
        width: seatSize,
        height: seatSize,
        shape: 'RECTANGLE',
        rotation: 0,
        status,
        tariff,
      });
    }
  }

  return seats;
}

// ============================================================================
// WRAPPER COMPONENT
// ============================================================================

interface WrapperProps {
  seats: Seat[];
  stage?: Stage;
  aisles?: Aisle[];
  width?: number;
  height?: number;
  minZoom?: number;
  maxZoom?: number;
  readOnly?: boolean;
  showTooltip?: boolean;
  backgroundColor?: string;
}

const SeatMapWrapper: React.FC<WrapperProps> = ({
  seats,
  stage,
  aisles,
  width = 800,
  height = 600,
  minZoom = 0.5,
  maxZoom = 3,
  readOnly = false,
  showTooltip = true,
  backgroundColor = '#0f172a',
}) => {
  const [selectedSeats, setSelectedSeats] = useState<string[]>([]);

  const handleSeatClick = useCallback((seat: Seat) => {
    setSelectedSeats((prev) =>
      prev.includes(seat.id)
        ? prev.filter((id) => id !== seat.id)
        : [...prev, seat.id]
    );
  }, []);

  const totalPrice = selectedSeats.reduce((sum, id) => {
    const seat = seats.find((s) => s.id === id);
    return sum + (seat?.tariff?.price ?? 0);
  }, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor }}>
      <div style={{ padding: 16, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <SeatMapLegend tariffs={TARIFFS} showSelected />
      </div>
      
      <div style={{ flex: 1, minHeight: 0 }}>
        <CanvasSeatMap
          width={width}
          height={height}
          seats={seats}
          selectedSeats={selectedSeats}
          onSeatClick={handleSeatClick}
          stage={stage}
          aisles={aisles}
          minZoom={minZoom}
          maxZoom={maxZoom}
          readOnly={readOnly}
          showTooltip={showTooltip}
          backgroundColor={backgroundColor}
        />
      </div>

      <div style={{ padding: 16 }}>
        <SelectionSummary
          selectedCount={selectedSeats.length}
          totalPrice={totalPrice}
          onClear={() => setSelectedSeats([])}
          onProceed={() => alert(`Selected ${selectedSeats.length} seats`)}
        />
      </div>
    </div>
  );
};

// ============================================================================
// STORIES
// ============================================================================

const theaterData = generateTheaterSeats();

export const Default: Story = {
  render: () => (
    <SeatMapWrapper
      seats={theaterData.seats}
      stage={theaterData.stage}
      aisles={theaterData.aisles}
    />
  ),
};

export const Theater: Story = {
  render: () => (
    <SeatMapWrapper
      seats={theaterData.seats}
      stage={theaterData.stage}
      aisles={theaterData.aisles}
    />
  ),
  parameters: {
    docs: {
      description: {
        story: 'A classic theater layout with rectangular seats, a stage, and aisles.',
      },
    },
  },
};

const stadiumData = generateStadiumSeats();

export const Stadium: Story = {
  render: () => (
    <SeatMapWrapper
      seats={stadiumData.seats}
      stage={stadiumData.stage}
      width={800}
      height={700}
    />
  ),
  parameters: {
    docs: {
      description: {
        story: 'A circular stadium layout with rotated seats around a central field.',
      },
    },
  },
};

export const LargeVenue: Story = {
  render: () => (
    <SeatMapWrapper
      seats={generateLargeVenue()}
      width={1000}
      height={1400}
      minZoom={0.3}
      maxZoom={5}
    />
  ),
  parameters: {
    docs: {
      description: {
        story: 'A large venue with 2000 seats, demonstrating performance with spatial indexing.',
      },
    },
  },
};

export const ReadOnly: Story = {
  render: () => (
    <SeatMapWrapper
      seats={theaterData.seats}
      stage={theaterData.stage}
      aisles={theaterData.aisles}
      readOnly
    />
  ),
  parameters: {
    docs: {
      description: {
        story: 'Read-only mode where interactions are disabled.',
      },
    },
  },
};

export const NoTooltip: Story = {
  render: () => (
    <SeatMapWrapper
      seats={theaterData.seats}
      stage={theaterData.stage}
      showTooltip={false}
    />
  ),
  parameters: {
    docs: {
      description: {
        story: 'Seat map with tooltips disabled.',
      },
    },
  },
};

export const CustomZoomLimits: Story = {
  render: () => (
    <SeatMapWrapper
      seats={theaterData.seats}
      stage={theaterData.stage}
      minZoom={0.8}
      maxZoom={2}
    />
  ),
  parameters: {
    docs: {
      description: {
        story: 'Custom zoom limits (0.8x to 2x) for constrained zooming.',
      },
    },
  },
};

export const DarkTheme: Story = {
  render: () => (
    <SeatMapWrapper
      seats={theaterData.seats}
      stage={theaterData.stage}
      aisles={theaterData.aisles}
      backgroundColor="#0f172a"
    />
  ),
};

export const LightTheme: Story = {
  render: () => (
    <SeatMapWrapper
      seats={theaterData.seats}
      stage={theaterData.stage}
      aisles={theaterData.aisles}
      backgroundColor="#f8fafc"
    />
  ),
  parameters: {
    docs: {
      description: {
        story: 'Light theme variant of the seat map.',
      },
    },
  },
};

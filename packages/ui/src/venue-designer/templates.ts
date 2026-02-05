import { v4 as uuidv4 } from 'uuid';
import type { VenueSchema, DesignerSeat, DesignerSection, DesignerStage, DesignerAisle } from './types';

// ============================================================================
// VENUE TEMPLATES
// ============================================================================

export interface VenueTemplate {
  name: string;
  description: string;
  thumbnail?: string;
  schema: VenueSchema;
}

// ============================================================================
// THEATER TEMPLATE
// ============================================================================

function createTheaterTemplate(): VenueSchema {
  const seats: DesignerSeat[] = [];
  const sections: DesignerSection[] = [];
  const aisles: DesignerAisle[] = [];

  const rows = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
  const seatsPerRow = 16;
  const seatWidth = 32;
  const seatHeight = 32;
  const horizontalSpacing = 36;
  const verticalSpacing = 40;
  const startX = 88;
  const startY = 140;
  const aisleGap = 40; // Gap in the middle for aisle

  // Create section IDs
  const vipSectionId = uuidv4();
  const premiumSectionId = uuidv4();
  const standardSectionId = uuidv4();

  const vipSeats: string[] = [];
  const premiumSeats: string[] = [];
  const standardSeats: string[] = [];

  // Generate seats
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex];
    const y = startY + rowIndex * verticalSpacing;

    for (let seatIndex = 0; seatIndex < seatsPerRow; seatIndex++) {
      // Add gap in middle for aisle
      const xOffset = seatIndex >= seatsPerRow / 2 ? aisleGap : 0;
      const x = startX + seatIndex * horizontalSpacing + xOffset;

      const seatId = uuidv4();
      let sectionName: string;

      // Assign to sections based on row
      if (rowIndex < 2) {
        sectionName = 'VIP';
        vipSeats.push(seatId);
      } else if (rowIndex < 5) {
        sectionName = 'Premium';
        premiumSeats.push(seatId);
      } else {
        sectionName = 'Standard';
        standardSeats.push(seatId);
      }

      seats.push({
        id: seatId,
        row,
        number: String(seatIndex + 1),
        section: sectionName,
        x,
        y,
        width: seatWidth,
        height: seatHeight,
        shape: 'RECTANGLE',
        rotation: 0,
      });
    }
  }

  // Create sections
  sections.push(
    {
      id: vipSectionId,
      name: 'VIP',
      color: '#eab308', // gold
      seatIds: vipSeats,
    },
    {
      id: premiumSectionId,
      name: 'Premium',
      color: '#8b5cf6', // purple
      seatIds: premiumSeats,
    },
    {
      id: standardSectionId,
      name: 'Standard',
      color: '#3b82f6', // blue
      seatIds: standardSeats,
    }
  );

  // Create aisles
  const aisleX = startX + (seatsPerRow / 2) * horizontalSpacing - 5;
  aisles.push(
    {
      id: uuidv4(),
      points: [
        { x: aisleX, y: startY - 10 },
        { x: aisleX, y: startY + rows.length * verticalSpacing + 20 },
      ],
    },
    // Left aisle
    {
      id: uuidv4(),
      points: [
        { x: startX - 30, y: startY - 10 },
        { x: startX - 30, y: startY + rows.length * verticalSpacing + 20 },
      ],
    },
    // Right aisle
    {
      id: uuidv4(),
      points: [
        { x: startX + seatsPerRow * horizontalSpacing + aisleGap + 10, y: startY - 10 },
        { x: startX + seatsPerRow * horizontalSpacing + aisleGap + 10, y: startY + rows.length * verticalSpacing + 20 },
      ],
    }
  );

  // Stage
  const stage: DesignerStage = {
    x: 100,
    y: 30,
    width: 600,
    height: 80,
    label: 'STAGE',
  };

  return {
    width: 800,
    height: 600,
    stage,
    sections,
    seats,
    aisles,
  };
}

// ============================================================================
// STADIUM TEMPLATE
// ============================================================================

function createStadiumTemplate(): VenueSchema {
  const seats: DesignerSeat[] = [];
  const sections: DesignerSection[] = [];
  const aisles: DesignerAisle[] = [];

  const centerX = 450;
  const centerY = 350;
  const innerRadius = 120;
  const rowSpacing = 30;
  const numRows = 8;
  const seatsPerRow = 32;

  // Section definitions
  const sectionDefs = [
    { name: 'North', startAngle: -60, endAngle: 60, color: '#3b82f6' },
    { name: 'East', startAngle: 60, endAngle: 120, color: '#10b981' },
    { name: 'South', startAngle: 120, endAngle: 240, color: '#8b5cf6' },
    { name: 'West', startAngle: 240, endAngle: 300, color: '#f59e0b' },
  ];

  const sectionSeats: Map<string, string[]> = new Map();
  sectionDefs.forEach((s) => sectionSeats.set(s.name, []));

  // Generate seats in circular pattern
  for (let rowIndex = 0; rowIndex < numRows; rowIndex++) {
    const radius = innerRadius + rowIndex * rowSpacing;
    const circumference = 2 * Math.PI * radius;
    const seatsInThisRow = Math.floor((circumference / 35) * 0.7); // 70% filled

    for (let seatIndex = 0; seatIndex < seatsInThisRow; seatIndex++) {
      const angle = (seatIndex / seatsInThisRow) * 360;

      // Determine section
      let sectionName = 'North';
      for (const def of sectionDefs) {
        let normalizedAngle = angle;
        if (normalizedAngle < 0) normalizedAngle += 360;
        if (normalizedAngle >= 360) normalizedAngle -= 360;

        let start = def.startAngle;
        let end = def.endAngle;
        if (start < 0) start += 360;
        if (end < 0) end += 360;

        if (start < end) {
          if (normalizedAngle >= start && normalizedAngle < end) {
            sectionName = def.name;
            break;
          }
        } else {
          // Wraps around 360
          if (normalizedAngle >= start || normalizedAngle < end) {
            sectionName = def.name;
            break;
          }
        }
      }

      const rad = (angle * Math.PI) / 180;
      const x = centerX + Math.cos(rad) * radius - 12;
      const y = centerY + Math.sin(rad) * radius - 12;

      const seatId = uuidv4();
      sectionSeats.get(sectionName)!.push(seatId);

      seats.push({
        id: seatId,
        row: String.fromCharCode(65 + rowIndex), // A, B, C...
        number: String(seatIndex + 1),
        section: sectionName,
        x,
        y,
        width: 24,
        height: 24,
        shape: 'CIRCLE',
        rotation: angle + 90, // Face towards center
      });
    }
  }

  // Create sections
  for (const def of sectionDefs) {
    sections.push({
      id: uuidv4(),
      name: def.name,
      color: def.color,
      seatIds: sectionSeats.get(def.name) || [],
    });
  }

  // Stage (field in center)
  const stage: DesignerStage = {
    x: centerX - 80,
    y: centerY - 60,
    width: 160,
    height: 120,
    label: 'FIELD',
  };

  return {
    width: 900,
    height: 700,
    stage,
    sections,
    seats,
    aisles,
  };
}

// ============================================================================
// CINEMA TEMPLATE
// ============================================================================

function createCinemaTemplate(): VenueSchema {
  const seats: DesignerSeat[] = [];
  const sections: DesignerSection[] = [];
  const aisles: DesignerAisle[] = [];

  const rows = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
  const startX = 100;
  const startY = 200;
  const seatWidth = 34;
  const seatHeight = 34;
  const horizontalSpacing = 38;
  const verticalSpacing = 45;

  // Cinema has wider spacing and curved rows
  const standardSectionId = uuidv4();
  const standardSeats: string[] = [];

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex];
    // Slightly curved - outer rows have more seats
    const seatsInRow = 12 + Math.floor(rowIndex / 2);
    const rowOffset = (rows.length - 1 - rowIndex) * 5; // Curve effect
    const y = startY + rowIndex * verticalSpacing;

    for (let seatIndex = 0; seatIndex < seatsInRow; seatIndex++) {
      // Center the row
      const totalWidth = seatsInRow * horizontalSpacing;
      const rowStartX = (800 - totalWidth) / 2 + rowOffset;
      const x = rowStartX + seatIndex * horizontalSpacing;

      const seatId = uuidv4();
      standardSeats.push(seatId);

      seats.push({
        id: seatId,
        row,
        number: String(seatIndex + 1),
        section: 'Standard',
        x,
        y,
        width: seatWidth,
        height: seatHeight,
        shape: 'RECTANGLE',
        rotation: 0,
      });
    }
  }

  // Create section
  sections.push({
    id: standardSectionId,
    name: 'Standard',
    color: '#6366f1', // indigo
    seatIds: standardSeats,
  });

  // Screen (stage)
  const stage: DesignerStage = {
    x: 80,
    y: 40,
    width: 640,
    height: 100,
    label: 'SCREEN',
  };

  // Aisles (left and right)
  aisles.push(
    {
      id: uuidv4(),
      points: [
        { x: 70, y: 150 },
        { x: 70, y: startY + rows.length * verticalSpacing + 30 },
      ],
    },
    {
      id: uuidv4(),
      points: [
        { x: 730, y: 150 },
        { x: 730, y: startY + rows.length * verticalSpacing + 30 },
      ],
    }
  );

  return {
    width: 800,
    height: 600,
    stage,
    sections,
    seats,
    aisles,
  };
}

// ============================================================================
// CONFERENCE TEMPLATE
// ============================================================================

function createConferenceTemplate(): VenueSchema {
  const seats: DesignerSeat[] = [];
  const sections: DesignerSection[] = [];
  const aisles: DesignerAisle[] = [];

  const leftSectionId = uuidv4();
  const rightSectionId = uuidv4();
  const leftSeats: string[] = [];
  const rightSeats: string[] = [];

  const rows = 6;
  const seatsPerSide = 8;
  const seatWidth = 30;
  const seatHeight = 30;
  const horizontalSpacing = 35;
  const verticalSpacing = 40;

  // Left section
  for (let rowIndex = 0; rowIndex < rows; rowIndex++) {
    const row = String.fromCharCode(65 + rowIndex);
    const y = 180 + rowIndex * verticalSpacing;

    for (let seatIndex = 0; seatIndex < seatsPerSide; seatIndex++) {
      const x = 80 + seatIndex * horizontalSpacing;
      const seatId = uuidv4();
      leftSeats.push(seatId);

      seats.push({
        id: seatId,
        row,
        number: String(seatIndex + 1),
        section: 'Left',
        x,
        y,
        width: seatWidth,
        height: seatHeight,
        shape: 'RECTANGLE',
        rotation: 0,
      });
    }
  }

  // Right section
  for (let rowIndex = 0; rowIndex < rows; rowIndex++) {
    const row = String.fromCharCode(65 + rowIndex);
    const y = 180 + rowIndex * verticalSpacing;

    for (let seatIndex = 0; seatIndex < seatsPerSide; seatIndex++) {
      const x = 440 + seatIndex * horizontalSpacing;
      const seatId = uuidv4();
      rightSeats.push(seatId);

      seats.push({
        id: seatId,
        row,
        number: String(seatsPerSide + seatIndex + 1),
        section: 'Right',
        x,
        y,
        width: seatWidth,
        height: seatHeight,
        shape: 'RECTANGLE',
        rotation: 0,
      });
    }
  }

  // Create sections
  sections.push(
    {
      id: leftSectionId,
      name: 'Left',
      color: '#3b82f6',
      seatIds: leftSeats,
    },
    {
      id: rightSectionId,
      name: 'Right',
      color: '#10b981',
      seatIds: rightSeats,
    }
  );

  // Podium/Stage
  const stage: DesignerStage = {
    x: 300,
    y: 40,
    width: 200,
    height: 100,
    label: 'PODIUM',
  };

  // Center aisle
  aisles.push({
    id: uuidv4(),
    points: [
      { x: 400, y: 160 },
      { x: 400, y: 180 + rows * verticalSpacing + 30 },
    ],
  });

  return {
    width: 800,
    height: 500,
    stage,
    sections,
    seats,
    aisles,
  };
}

// ============================================================================
// EXPORT TEMPLATES
// ============================================================================

export const VENUE_TEMPLATES: VenueTemplate[] = [
  {
    name: 'Theater',
    description: 'Classic theater layout with VIP, Premium, and Standard sections',
    schema: createTheaterTemplate(),
  },
  {
    name: 'Stadium',
    description: 'Circular stadium layout with four sections around a central field',
    schema: createStadiumTemplate(),
  },
  {
    name: 'Cinema',
    description: 'Movie theater with curved rows facing the screen',
    schema: createCinemaTemplate(),
  },
  {
    name: 'Conference',
    description: 'Conference room with two sections and central podium',
    schema: createConferenceTemplate(),
  },
];

/**
 * Get a venue template by name
 */
export function getTemplate(name: string): VenueTemplate | undefined {
  return VENUE_TEMPLATES.find((t) => t.name.toLowerCase() === name.toLowerCase());
}

/**
 * Create an empty venue schema
 */
export function createEmptySchema(width: number = 800, height: number = 600): VenueSchema {
  return {
    width,
    height,
    stage: undefined,
    sections: [],
    seats: [],
    aisles: [],
  };
}

export default VENUE_TEMPLATES;

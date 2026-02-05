import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../main.js';
import { prisma, UserRole } from '@repo/database';
import type { VenueSchemaType } from './venue.types.js';
import { venueService } from './venue.service.js';

// Valid sample venue schema
const createValidSchema = (): VenueSchemaType => ({
  width: 800,
  height: 600,
  stage: {
    x: 300,
    y: 20,
    width: 200,
    height: 50,
  },
  sections: [
    {
      id: 'section-a',
      name: 'Section A',
      color: '#22c55e',
      seatIds: ['seat-a1-1', 'seat-a1-2', 'seat-a1-3', 'seat-a2-1', 'seat-a2-2', 'seat-a2-3'],
    },
  ],
  seats: [
    { id: 'seat-a1-1', row: 'A', number: '1', section: 'section-a', x: 100, y: 100, width: 30, height: 30, shape: 'RECTANGLE', rotation: 0 },
    { id: 'seat-a1-2', row: 'A', number: '2', section: 'section-a', x: 140, y: 100, width: 30, height: 30, shape: 'RECTANGLE', rotation: 0 },
    { id: 'seat-a1-3', row: 'A', number: '3', section: 'section-a', x: 180, y: 100, width: 30, height: 30, shape: 'RECTANGLE', rotation: 0 },
    { id: 'seat-a2-1', row: 'B', number: '1', section: 'section-a', x: 100, y: 140, width: 30, height: 30, shape: 'RECTANGLE', rotation: 0 },
    { id: 'seat-a2-2', row: 'B', number: '2', section: 'section-a', x: 140, y: 140, width: 30, height: 30, shape: 'RECTANGLE', rotation: 0 },
    { id: 'seat-a2-3', row: 'B', number: '3', section: 'section-a', x: 180, y: 140, width: 30, height: 30, shape: 'RECTANGLE', rotation: 0 },
  ],
  aisles: [
    {
      id: 'aisle-1',
      points: [{ x: 90, y: 100 }, { x: 90, y: 200 }],
    },
  ],
});

describe('Venue API', () => {
  let testVenueId: string;
  let adminUserId: string;
  let managerUserId: string;
  let regularUserId: string;

  beforeAll(async () => {
    // Clean up test data
    await prisma.venue.deleteMany({
      where: { name: { startsWith: 'Test Venue' } },
    });
    await prisma.user.deleteMany({
      where: { email: { startsWith: 'test-venue-' } },
    });

    // Create test users
    const [adminUser, managerUser, regularUser] = await Promise.all([
      prisma.user.create({
        data: {
          email: 'test-venue-admin@example.com',
          name: 'Test Admin',
          role: UserRole.ADMIN,
          passwordHash: 'hash',
        },
      }),
      prisma.user.create({
        data: {
          email: 'test-venue-manager@example.com',
          name: 'Test Manager',
          role: UserRole.MANAGER,
          passwordHash: 'hash',
        },
      }),
      prisma.user.create({
        data: {
          email: 'test-venue-user@example.com',
          name: 'Test User',
          role: UserRole.USER,
          passwordHash: 'hash',
        },
      }),
    ]);

    adminUserId = adminUser.id;
    managerUserId = managerUser.id;
    regularUserId = regularUser.id;
  });

  afterAll(async () => {
    await prisma.venue.deleteMany({
      where: { name: { startsWith: 'Test Venue' } },
    });
    await prisma.user.deleteMany({
      where: { email: { startsWith: 'test-venue-' } },
    });
    await prisma.$disconnect();
  });

  // =========================================================================
  // SCHEMA VALIDATION UNIT TESTS
  // =========================================================================

  describe('validateSchema()', () => {
    it('should validate a correct schema', () => {
      const schema = createValidSchema();
      const result = venueService.validateSchema(schema);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.stats.totalSeats).toBe(6);
      expect(result.stats.totalSections).toBe(1);
    });

    it('should reject schema with no seats', () => {
      const schema: VenueSchemaType = {
        width: 800,
        height: 600,
        sections: [{ id: 's1', name: 'Section', color: '#ffffff', seatIds: [] }],
        seats: [],
        aisles: [],
      };

      const result = venueService.validateSchema(schema);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'NO_SEATS')).toBe(true);
    });

    it('should reject seats outside canvas bounds (x)', () => {
      const schema = createValidSchema();
      schema.seats[0].x = 790; // x + width (30) = 820 > 800

      const result = venueService.validateSchema(schema);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'SEAT_OUT_OF_BOUNDS')).toBe(true);
    });

    it('should reject seats outside canvas bounds (y)', () => {
      const schema = createValidSchema();
      schema.seats[0].y = 590; // y + height (30) = 620 > 600

      const result = venueService.validateSchema(schema);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'SEAT_OUT_OF_BOUNDS')).toBe(true);
    });

    it('should reject seats with negative coordinates', () => {
      const schema = createValidSchema();
      schema.seats[0].x = -10;

      const result = venueService.validateSchema(schema);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'SEAT_OUT_OF_BOUNDS')).toBe(true);
    });

    it('should detect overlapping seats', () => {
      const schema = createValidSchema();
      // Place seat 2 at same position as seat 1
      schema.seats[1].x = 100;
      schema.seats[1].y = 100;

      const result = venueService.validateSchema(schema);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'SEATS_OVERLAP')).toBe(true);
    });

    it('should detect partially overlapping seats', () => {
      const schema = createValidSchema();
      // Seat 2 overlaps with seat 1 by 10px
      schema.seats[1].x = 120; // 100 + 30 - 10 = 120

      const result = venueService.validateSchema(schema);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'SEATS_OVERLAP')).toBe(true);
    });

    it('should allow adjacent (touching) seats without overlap', () => {
      const schema = createValidSchema();
      // Seat 2 is exactly adjacent to seat 1
      schema.seats[1].x = 130; // 100 + 30 = 130 (touching, not overlapping)

      const result = venueService.validateSchema(schema);

      // Should be valid - touching is OK
      expect(result.errors.filter((e) => e.code === 'SEATS_OVERLAP')).toHaveLength(0);
    });

    it('should reject invalid section reference in seat', () => {
      const schema = createValidSchema();
      schema.seats[0].section = 'non-existent-section';

      const result = venueService.validateSchema(schema);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'INVALID_SECTION_REFERENCE')).toBe(true);
    });

    it('should reject invalid seat reference in section', () => {
      const schema = createValidSchema();
      schema.sections[0].seatIds.push('non-existent-seat');

      const result = venueService.validateSchema(schema);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'INVALID_SEAT_REFERENCE')).toBe(true);
    });

    it('should reject duplicate seat IDs', () => {
      const schema = createValidSchema();
      schema.seats[1].id = schema.seats[0].id; // Duplicate ID

      const result = venueService.validateSchema(schema);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'DUPLICATE_SEAT_ID')).toBe(true);
    });

    it('should reject duplicate section IDs', () => {
      const schema = createValidSchema();
      schema.sections.push({
        ...schema.sections[0],
        name: 'Section B',
        // Same ID as section A
      });

      const result = venueService.validateSchema(schema);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'DUPLICATE_SECTION_ID')).toBe(true);
    });

    it('should reject stage outside canvas bounds', () => {
      const schema = createValidSchema();
      schema.stage = { x: 700, y: 0, width: 200, height: 50 }; // 700 + 200 > 800

      const result = venueService.validateSchema(schema);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'STAGE_OUT_OF_BOUNDS')).toBe(true);
    });

    it('should warn about empty sections', () => {
      const schema = createValidSchema();
      schema.sections.push({
        id: 'empty-section',
        name: 'Empty Section',
        color: '#ff0000',
        seatIds: [],
      });

      const result = venueService.validateSchema(schema);

      expect(result.warnings.some((w) => w.includes('Empty Section'))).toBe(true);
    });
  });

  // =========================================================================
  // API ENDPOINT TESTS
  // =========================================================================

  describe('POST /api/venues (Create)', () => {
    it('should create venue with valid schema', async () => {
      const response = await request(app)
        .post('/api/venues')
        .set('Authorization', `Bearer ${adminUserId}`)
        .send({
          name: 'Test Venue Valid',
          address: '123 Test Street',
          schema: createValidSchema(),
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.capacity).toBe(6);
      testVenueId = response.body.data.id;
    });

    it('should reject schema with no seats', async () => {
      const response = await request(app)
        .post('/api/venues')
        .set('Authorization', `Bearer ${adminUserId}`)
        .send({
          name: 'Test Venue No Seats',
          address: '123 Test Street',
          schema: {
            width: 800,
            height: 600,
            sections: [{ id: 's1', name: 'Section', color: '#ffffff', seatIds: [] }],
            seats: [],
          },
        });

      expect(response.status).toBe(400);
    });

    it('should reject schema with overlapping seats', async () => {
      const schema = createValidSchema();
      schema.seats[1].x = 100;
      schema.seats[1].y = 100;

      const response = await request(app)
        .post('/api/venues')
        .set('Authorization', `Bearer ${adminUserId}`)
        .send({
          name: 'Test Venue Overlapping',
          address: '123 Test Street',
          schema,
        });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('INVALID_VENUE_SCHEMA');
    });

    it('should reject schema with out-of-bounds seats', async () => {
      const schema = createValidSchema();
      schema.seats[0].x = 900;

      const response = await request(app)
        .post('/api/venues')
        .set('Authorization', `Bearer ${adminUserId}`)
        .send({
          name: 'Test Venue Out of Bounds',
          address: '123 Test Street',
          schema,
        });

      expect(response.status).toBe(400);
    });
  });

  describe('PUT /api/venues/:id/schema (Update Schema)', () => {
    it('should update schema with valid data', async () => {
      const newSchema = createValidSchema();
      newSchema.seats = newSchema.seats.slice(0, 2);
      newSchema.sections[0].seatIds = ['seat-a1-1', 'seat-a1-2'];

      const response = await request(app)
        .put(`/api/venues/${testVenueId}/schema`)
        .set('Authorization', `Bearer ${adminUserId}`)
        .send({ schema: newSchema });

      expect(response.status).toBe(200);
      expect(response.body.data.capacity).toBe(2);
    });

    it('should reject invalid schema update', async () => {
      const schema = createValidSchema();
      schema.seats[0].x = -100;

      const response = await request(app)
        .put(`/api/venues/${testVenueId}/schema`)
        .set('Authorization', `Bearer ${adminUserId}`)
        .send({ schema });

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/venues/validate-schema', () => {
    it('should return validation result for valid schema', async () => {
      const response = await request(app)
        .post('/api/venues/validate-schema')
        .set('Authorization', `Bearer ${adminUserId}`)
        .send(createValidSchema());

      expect(response.status).toBe(200);
      expect(response.body.data.valid).toBe(true);
      expect(response.body.data.errors).toHaveLength(0);
      expect(response.body.data.stats.totalSeats).toBe(6);
    });

    it('should return errors for invalid schema', async () => {
      const schema = createValidSchema();
      schema.seats[0].x = 900;

      const response = await request(app)
        .post('/api/venues/validate-schema')
        .set('Authorization', `Bearer ${adminUserId}`)
        .send(schema);

      expect(response.status).toBe(400); // Zod fails first
    });
  });

  describe('Authorization', () => {
    it('should allow MANAGER to create venue', async () => {
      const response = await request(app)
        .post('/api/venues')
        .set('Authorization', `Bearer ${managerUserId}`)
        .send({
          name: 'Test Venue Manager',
          address: '123 Manager Street',
          schema: createValidSchema(),
        });

      expect(response.status).toBe(201);
    });

    it('should reject USER from creating venue', async () => {
      const response = await request(app)
        .post('/api/venues')
        .set('Authorization', `Bearer ${regularUserId}`)
        .send({
          name: 'Test Venue User',
          address: '123 User Street',
          schema: createValidSchema(),
        });

      expect(response.status).toBe(403);
    });

    it('should allow only ADMIN to delete', async () => {
      const createResponse = await request(app)
        .post('/api/venues')
        .set('Authorization', `Bearer ${adminUserId}`)
        .send({
          name: 'Test Venue Delete Auth',
          address: '123 Delete Street',
          schema: createValidSchema(),
        });

      const venueId = createResponse.body.data.id;

      // Manager should not be able to delete
      const managerDelete = await request(app)
        .delete(`/api/venues/${venueId}`)
        .set('Authorization', `Bearer ${managerUserId}`);

      expect(managerDelete.status).toBe(403);

      // Admin should be able to delete
      const adminDelete = await request(app)
        .delete(`/api/venues/${venueId}`)
        .set('Authorization', `Bearer ${adminUserId}`);

      expect(adminDelete.status).toBe(200);
    });
  });

  describe('GET /api/venues (Public)', () => {
    it('should return venues with session count', async () => {
      const response = await request(app).get('/api/venues');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data)).toBe(true);
      response.body.data.forEach((venue: { _count: { sessions: number } }) => {
        expect(venue._count).toBeDefined();
        expect(typeof venue._count.sessions).toBe('number');
      });
    });
  });

  describe('DELETE /api/venues/:id (Soft Delete)', () => {
    it('should soft delete (deactivate) venue', async () => {
      const createResponse = await request(app)
        .post('/api/venues')
        .set('Authorization', `Bearer ${adminUserId}`)
        .send({
          name: 'Test Venue Soft Delete',
          address: '123 Soft Delete Street',
          schema: createValidSchema(),
        });

      const venueId = createResponse.body.data.id;

      const response = await request(app)
        .delete(`/api/venues/${venueId}`)
        .set('Authorization', `Bearer ${adminUserId}`);

      expect(response.status).toBe(200);

      // Verify soft delete
      const venue = await prisma.venue.findUnique({ where: { id: venueId } });
      expect(venue).not.toBeNull();
      expect(venue?.isActive).toBe(false);
    });
  });
});

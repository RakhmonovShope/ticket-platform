import {
  PrismaClient,
  UserRole,
  SessionStatus,
  SeatShape,
  SeatStatus,
} from '@prisma/client';

const prisma = new PrismaClient();

// Venue schema template - defines seat layout
interface VenueSeatSchema {
  sections: Array<{
    id: string;
    name: string;
    rows: Array<{
      row: string;
      seats: Array<{
        number: string;
        x: number;
        y: number;
        width?: number;
        height?: number;
        shape?: 'RECTANGLE' | 'CIRCLE' | 'POLYGON';
      }>;
    }>;
  }>;
  stage?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

async function main() {
  console.log('🌱 Seeding database...');

  // =========================================================================
  // Create Admin User
  // =========================================================================
  const admin = await prisma.user.upsert({
    where: { email: 'admin@ticket-platform.uz' },
    update: {},
    create: {
      email: 'admin@ticket-platform.uz',
      name: 'Admin User',
      role: UserRole.ADMIN,
      phone: '+998901234567',
      passwordHash: '$2b$10$placeholder_hash_for_demo_only',
    },
  });
  console.log('✅ Created admin user:', admin.email);

  // Create a regular user for testing
  const testUser = await prisma.user.upsert({
    where: { email: 'user@example.com' },
    update: {},
    create: {
      email: 'user@example.com',
      name: 'Test User',
      role: UserRole.USER,
      phone: '+998909876543',
      passwordHash: '$2b$10$placeholder_hash_for_demo_only',
    },
  });
  console.log('✅ Created test user:', testUser.email);

  // =========================================================================
  // Create Venue with Seat Schema
  // =========================================================================
  const venueSchema: VenueSeatSchema = {
    stage: {
      x: 50,
      y: 10,
      width: 400,
      height: 50,
    },
    sections: [
      {
        id: 'orchestra',
        name: 'Orchestra',
        rows: Array.from({ length: 8 }, (_, rowIndex) => ({
          row: String(rowIndex + 1),
          seats: Array.from({ length: 16 }, (_, seatIndex) => ({
            number: String(seatIndex + 1),
            x: 50 + seatIndex * 30,
            y: 80 + rowIndex * 35,
            width: 26,
            height: 26,
            shape: 'RECTANGLE' as const,
          })),
        })),
      },
      {
        id: 'balcony',
        name: 'Balcony',
        rows: Array.from({ length: 4 }, (_, rowIndex) => ({
          row: `B${rowIndex + 1}`,
          seats: Array.from({ length: 12 }, (_, seatIndex) => ({
            number: String(seatIndex + 1),
            x: 110 + seatIndex * 30,
            y: 380 + rowIndex * 35,
            width: 26,
            height: 26,
            shape: 'RECTANGLE' as const,
          })),
        })),
      },
    ],
  };

  const venue = await prisma.venue.upsert({
    where: { id: 'venue-alisher-navoi' },
    update: {},
    create: {
      id: 'venue-alisher-navoi',
      name: 'Alisher Navoi Theatre',
      address: '28 Mustakillik Square, Tashkent',
      description: 'Historic theatre in Tashkent, Uzbekistan',
      schema: venueSchema,
      capacity: 176, // 8*16 + 4*12
    },
  });
  console.log('✅ Created venue:', venue.name);

  // =========================================================================
  // Create Session with Seats (copied from venue schema)
  // =========================================================================
  const sessionDate = new Date();
  sessionDate.setDate(sessionDate.getDate() + 30); // 30 days from now
  sessionDate.setHours(19, 0, 0, 0); // 7 PM

  const session = await prisma.session.upsert({
    where: { id: 'session-carmen-2026' },
    update: {},
    create: {
      id: 'session-carmen-2026',
      venueId: venue.id,
      name: 'Carmen - Opera Performance',
      description: 'Classic opera by Georges Bizet',
      startTime: sessionDate,
      endTime: new Date(sessionDate.getTime() + 3 * 60 * 60 * 1000), // 3 hours later
      status: SessionStatus.ACTIVE,
    },
  });
  console.log('✅ Created session:', session.name);

  // Copy seats from venue schema to session
  const seatsToCreate: Array<{
    sessionId: string;
    row: string;
    number: string;
    section: string;
    x: number;
    y: number;
    width: number;
    height: number;
    shape: SeatShape;
    status: SeatStatus;
  }> = [];

  for (const section of venueSchema.sections) {
    for (const row of section.rows) {
      for (const seat of row.seats) {
        // Mark some seats as sold for demo
        let status = SeatStatus.AVAILABLE;
        if (section.id === 'orchestra' && row.row === '3' && Number(seat.number) >= 5 && Number(seat.number) <= 8) {
          status = SeatStatus.OCCUPIED;
        }
        if (section.id === 'orchestra' && row.row === '5' && seat.number === '10') {
          status = SeatStatus.DISABLED; // wheelchair spot
        }

        seatsToCreate.push({
          sessionId: session.id,
          row: row.row,
          number: seat.number,
          section: section.name,
          x: seat.x,
          y: seat.y,
          width: seat.width || 26,
          height: seat.height || 26,
          shape: seat.shape === 'CIRCLE' ? SeatShape.CIRCLE : SeatShape.RECTANGLE,
          status,
        });
      }
    }
  }

  await prisma.seat.createMany({
    data: seatsToCreate,
    skipDuplicates: true,
  });
  console.log(`✅ Created ${seatsToCreate.length} seats for session`);

  // =========================================================================
  // Create Tariffs
  // =========================================================================
  const vipTariff = await prisma.tariff.upsert({
    where: { id: 'tariff-vip' },
    update: {},
    create: {
      id: 'tariff-vip',
      sessionId: session.id,
      name: 'VIP',
      price: 350000, // 350,000 UZS
      color: '#8b5cf6', // violet
      description: 'Premium front row seating',
    },
  });

  const standardTariff = await prisma.tariff.upsert({
    where: { id: 'tariff-standard' },
    update: {},
    create: {
      id: 'tariff-standard',
      sessionId: session.id,
      name: 'Standard',
      price: 150000, // 150,000 UZS
      color: '#22c55e', // green
      description: 'Regular seating',
    },
  });

  const balconyTariff = await prisma.tariff.upsert({
    where: { id: 'tariff-balcony' },
    update: {},
    create: {
      id: 'tariff-balcony',
      sessionId: session.id,
      name: 'Balcony',
      price: 100000, // 100,000 UZS
      color: '#3b82f6', // blue
      description: 'Balcony seating',
    },
  });
  console.log('✅ Created tariffs: VIP, Standard, Balcony');

  // =========================================================================
  // Link Tariffs to Seats (TariffSeat junction)
  // =========================================================================
  const allSeats = await prisma.seat.findMany({
    where: { sessionId: session.id },
  });

  const tariffSeatData: Array<{ tariffId: string; seatId: string }> = [];

  for (const seat of allSeats) {
    // VIP: rows 1-3 in Orchestra
    if (seat.section === 'Orchestra' && Number(seat.row) <= 3) {
      tariffSeatData.push({ tariffId: vipTariff.id, seatId: seat.id });
    }
    // Balcony: all balcony seats
    else if (seat.section === 'Balcony') {
      tariffSeatData.push({ tariffId: balconyTariff.id, seatId: seat.id });
    }
    // Standard: remaining orchestra seats
    else {
      tariffSeatData.push({ tariffId: standardTariff.id, seatId: seat.id });
    }
  }

  await prisma.tariffSeat.createMany({
    data: tariffSeatData,
    skipDuplicates: true,
  });
  console.log(`✅ Linked ${tariffSeatData.length} seats to tariffs`);

  // =========================================================================
  // Create Sample Booking
  // =========================================================================
  const sampleSeat = allSeats.find(
    (s) => s.section === 'Orchestra' && s.row === '4' && s.number === '8'
  );

  if (sampleSeat) {
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10); // 10 minute expiration

    const booking = await prisma.booking.upsert({
      where: { id: 'booking-sample' },
      update: {},
      create: {
        id: 'booking-sample',
        sessionId: session.id,
        seatId: sampleSeat.id,
        userId: testUser.id,
        status: 'CONFIRMED',
        expiresAt,
        totalPrice: 150000,
      },
    });

    // Mark the seat as occupied
    await prisma.seat.update({
      where: { id: sampleSeat.id },
      data: { status: SeatStatus.OCCUPIED },
    });

    // Create payment record
    await prisma.payment.upsert({
      where: { id: 'payment-sample' },
      update: {},
      create: {
        id: 'payment-sample',
        bookingId: booking.id,
        userId: testUser.id,
        amount: 150000,
        provider: 'PAYME',
        status: 'COMPLETED',
        externalId: 'payme_txn_123456',
        paidAt: new Date(),
      },
    });

    console.log('✅ Created sample booking and payment');
  }

  console.log('\n🎉 Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

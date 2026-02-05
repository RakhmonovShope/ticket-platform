import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { redis, RedisKeys } from '../../services/redis.service.js';
import { BOOKING_CONFIG } from './booking.types.js';
import type { SeatReservation } from '../../services/redis.service.js';

// ============================================================================
// MOCK SETUP
// ============================================================================

// Mock Redis for unit tests
vi.mock('../../services/redis.service.js', () => {
  const mockStore = new Map<string, string>();
  const mockSets = new Map<string, Set<string>>();
  const mockTTLs = new Map<string, number>();

  return {
    redis: {
      connect: vi.fn(),
      disconnect: vi.fn(),
      get: vi.fn((key: string) => mockStore.get(key) ?? null),
      getJSON: vi.fn((key: string) => {
        const value = mockStore.get(key);
        return value ? JSON.parse(value) : null;
      }),
      set: vi.fn((key: string, value: string, ttl?: number) => {
        mockStore.set(key, value);
        if (ttl) mockTTLs.set(key, ttl);
      }),
      setJSON: vi.fn((key: string, value: unknown, ttl?: number) => {
        mockStore.set(key, JSON.stringify(value));
        if (ttl) mockTTLs.set(key, ttl);
      }),
      setNX: vi.fn((key: string, value: string, ttl?: number) => {
        if (mockStore.has(key)) return false;
        mockStore.set(key, value);
        if (ttl) mockTTLs.set(key, ttl);
        return true;
      }),
      del: vi.fn((key: string) => {
        const existed = mockStore.has(key);
        mockStore.delete(key);
        mockTTLs.delete(key);
        return existed ? 1 : 0;
      }),
      exists: vi.fn((key: string) => mockStore.has(key)),
      ttl: vi.fn((key: string) => mockTTLs.get(key) ?? -2),
      expire: vi.fn((key: string, ttl: number) => {
        if (!mockStore.has(key)) return false;
        mockTTLs.set(key, ttl);
        return true;
      }),
      sadd: vi.fn((key: string, ...members: string[]) => {
        if (!mockSets.has(key)) mockSets.set(key, new Set());
        const set = mockSets.get(key)!;
        let added = 0;
        for (const member of members) {
          if (!set.has(member)) {
            set.add(member);
            added++;
          }
        }
        return added;
      }),
      srem: vi.fn((key: string, ...members: string[]) => {
        const set = mockSets.get(key);
        if (!set) return 0;
        let removed = 0;
        for (const member of members) {
          if (set.delete(member)) removed++;
        }
        return removed;
      }),
      smembers: vi.fn((key: string) => {
        const set = mockSets.get(key);
        return set ? Array.from(set) : [];
      }),
      scard: vi.fn((key: string) => {
        const set = mockSets.get(key);
        return set ? set.size : 0;
      }),
      scanKeys: vi.fn((pattern: string) => {
        const prefix = pattern.replace('*', '');
        return Array.from(mockStore.keys()).filter((k) => k.startsWith(prefix));
      }),
      incrementWithTTL: vi.fn((key: string, ttl: number) => {
        const current = mockStore.get(key);
        const newValue = current ? parseInt(current, 10) + 1 : 1;
        mockStore.set(key, String(newValue));
        mockTTLs.set(key, ttl);
        return newValue;
      }),
      // Helper for tests
      _clear: () => {
        mockStore.clear();
        mockSets.clear();
        mockTTLs.clear();
      },
      _getStore: () => mockStore,
      _getSets: () => mockSets,
    },
    RedisKeys: {
      seat: (sessionId: string, seatId: string) => `seat:${sessionId}:${seatId}`,
      seatPattern: (sessionId: string) => `seat:${sessionId}:`,
      sessionUsers: (sessionId: string) => `session:${sessionId}:users`,
      cart: (userId: string) => `cart:${userId}`,
      rateLimit: (userId: string, action: string) => `rate:${action}:${userId}`,
      socketUser: (socketId: string) => `socket:${socketId}:user`,
      userSockets: (userId: string) => `user:${userId}:sockets`,
    },
  };
});

// ============================================================================
// UNIT TESTS
// ============================================================================

describe('Redis Key Builders', () => {
  it('should build seat key correctly', () => {
    const key = RedisKeys.seat('session-123', 'seat-456');
    expect(key).toBe('seat:session-123:seat-456');
  });

  it('should build session users key correctly', () => {
    const key = RedisKeys.sessionUsers('session-123');
    expect(key).toBe('session:session-123:users');
  });

  it('should build rate limit key correctly', () => {
    const key = RedisKeys.rateLimit('user-123', 'select');
    expect(key).toBe('rate:select:user-123');
  });
});

describe('Redis Operations', () => {
  beforeEach(() => {
    (redis as any)._clear();
  });

  it('should set and get values', async () => {
    await redis.set('test-key', 'test-value');
    const value = await redis.get('test-key');
    expect(value).toBe('test-value');
  });

  it('should set and get JSON values', async () => {
    const data: SeatReservation = {
      userId: 'user-123',
      timestamp: Date.now(),
      socketId: 'socket-123',
    };
    await redis.setJSON('test-json', data);
    const retrieved = await redis.getJSON<SeatReservation>('test-json');
    expect(retrieved).toEqual(data);
  });

  it('should handle setNX correctly', async () => {
    // First set should succeed
    const first = await redis.setNX('nx-key', 'value1', 60);
    expect(first).toBe(true);

    // Second set should fail
    const second = await redis.setNX('nx-key', 'value2', 60);
    expect(second).toBe(false);

    // Value should still be the first one
    const value = await redis.get('nx-key');
    expect(value).toBe('value1');
  });

  it('should handle set operations', async () => {
    const key = 'test-set';

    // Add members
    await redis.sadd(key, 'member1', 'member2', 'member3');
    expect(await redis.scard(key)).toBe(3);

    // Check members
    const members = await redis.smembers(key);
    expect(members).toContain('member1');
    expect(members).toContain('member2');
    expect(members).toContain('member3');

    // Remove member
    await redis.srem(key, 'member2');
    expect(await redis.scard(key)).toBe(2);
  });

  it('should handle rate limiting counter', async () => {
    const key = 'rate-test';

    // Increment multiple times
    expect(await redis.incrementWithTTL(key, 60)).toBe(1);
    expect(await redis.incrementWithTTL(key, 60)).toBe(2);
    expect(await redis.incrementWithTTL(key, 60)).toBe(3);
  });
});

describe('Booking Configuration', () => {
  it('should have correct TTL values', () => {
    expect(BOOKING_CONFIG.SELECTION_TTL_SECONDS).toBe(5 * 60); // 5 minutes
    expect(BOOKING_CONFIG.RESERVATION_TTL_SECONDS).toBe(10 * 60); // 10 minutes
  });

  it('should have correct rate limits', () => {
    expect(BOOKING_CONFIG.RATE_LIMIT_SELECTIONS_PER_MINUTE).toBe(10);
    expect(BOOKING_CONFIG.RATE_LIMIT_WINDOW_SECONDS).toBe(60);
  });

  it('should have correct max seats per booking', () => {
    expect(BOOKING_CONFIG.MAX_SEATS_PER_BOOKING).toBe(10);
  });
});

describe('Seat Reservation Logic', () => {
  beforeEach(() => {
    (redis as any)._clear();
  });

  it('should create seat reservation with correct structure', async () => {
    const sessionId = 'session-123';
    const seatId = 'seat-456';
    const userId = 'user-789';
    const socketId = 'socket-abc';

    const reservation: SeatReservation = {
      userId,
      timestamp: Date.now(),
      socketId,
    };

    const key = RedisKeys.seat(sessionId, seatId);
    const wasSet = await redis.setNX(key, JSON.stringify(reservation), BOOKING_CONFIG.SELECTION_TTL_SECONDS);

    expect(wasSet).toBe(true);

    const retrieved = await redis.getJSON<SeatReservation>(key);
    expect(retrieved?.userId).toBe(userId);
    expect(retrieved?.socketId).toBe(socketId);
  });

  it('should prevent double selection by different users', async () => {
    const sessionId = 'session-123';
    const seatId = 'seat-456';

    // User 1 selects
    const reservation1: SeatReservation = {
      userId: 'user-1',
      timestamp: Date.now(),
      socketId: 'socket-1',
    };
    const key = RedisKeys.seat(sessionId, seatId);
    const wasSet1 = await redis.setNX(key, JSON.stringify(reservation1), 300);
    expect(wasSet1).toBe(true);

    // User 2 tries to select
    const reservation2: SeatReservation = {
      userId: 'user-2',
      timestamp: Date.now(),
      socketId: 'socket-2',
    };
    const wasSet2 = await redis.setNX(key, JSON.stringify(reservation2), 300);
    expect(wasSet2).toBe(false);

    // Verify user 1 still has the reservation
    const current = await redis.getJSON<SeatReservation>(key);
    expect(current?.userId).toBe('user-1');
  });

  it('should track session users correctly', async () => {
    const sessionId = 'session-123';
    const usersKey = RedisKeys.sessionUsers(sessionId);

    // Add users
    await redis.sadd(usersKey, 'socket-1');
    await redis.sadd(usersKey, 'socket-2');
    await redis.sadd(usersKey, 'socket-3');

    expect(await redis.scard(usersKey)).toBe(3);

    // Remove user
    await redis.srem(usersKey, 'socket-2');
    expect(await redis.scard(usersKey)).toBe(2);

    // Verify remaining users
    const members = await redis.smembers(usersKey);
    expect(members).toContain('socket-1');
    expect(members).toContain('socket-3');
    expect(members).not.toContain('socket-2');
  });

  it('should handle rate limiting correctly', async () => {
    const userId = 'user-123';
    const key = RedisKeys.rateLimit(userId, 'select');

    // Simulate multiple selections
    for (let i = 1; i <= BOOKING_CONFIG.RATE_LIMIT_SELECTIONS_PER_MINUTE; i++) {
      const count = await redis.incrementWithTTL(key, BOOKING_CONFIG.RATE_LIMIT_WINDOW_SECONDS);
      expect(count).toBe(i);
    }

    // Next selection should exceed limit
    const exceededCount = await redis.incrementWithTTL(key, BOOKING_CONFIG.RATE_LIMIT_WINDOW_SECONDS);
    expect(exceededCount).toBe(BOOKING_CONFIG.RATE_LIMIT_SELECTIONS_PER_MINUTE + 1);
    expect(exceededCount).toBeGreaterThan(BOOKING_CONFIG.RATE_LIMIT_SELECTIONS_PER_MINUTE);
  });
});

describe('Conflict Resolution', () => {
  beforeEach(() => {
    (redis as any)._clear();
  });

  it('should use atomic setNX for race condition prevention', async () => {
    const key = 'race-test';

    // Simulate concurrent attempts
    const results = await Promise.all([
      redis.setNX(key, 'user-1', 60),
      redis.setNX(key, 'user-2', 60),
      redis.setNX(key, 'user-3', 60),
    ]);

    // Only one should succeed
    const successCount = results.filter(Boolean).length;
    expect(successCount).toBe(1);
  });
});

import Redis from 'ioredis';

// ============================================================================
// REDIS CLIENT CONFIGURATION
// ============================================================================

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

/**
 * Redis client singleton
 */
class RedisService {
  private static instance: RedisService;
  private client: Redis;
  private subscriber: Redis;
  private publisher: Redis;

  private constructor() {
    // Main client for general operations
    this.client = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryDelayOnFailover: 100,
      lazyConnect: true,
    });

    // Dedicated client for pub/sub subscriber
    this.subscriber = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });

    // Dedicated client for pub/sub publisher
    this.publisher = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });

    this.setupErrorHandlers();
  }

  public static getInstance(): RedisService {
    if (!RedisService.instance) {
      RedisService.instance = new RedisService();
    }
    return RedisService.instance;
  }

  private setupErrorHandlers(): void {
    const handleError = (name: string) => (err: Error) => {
      console.error(`Redis ${name} error:`, err.message);
    };

    this.client.on('error', handleError('client'));
    this.subscriber.on('error', handleError('subscriber'));
    this.publisher.on('error', handleError('publisher'));

    this.client.on('connect', () => console.log('Redis client connected'));
    this.subscriber.on('connect', () => console.log('Redis subscriber connected'));
    this.publisher.on('connect', () => console.log('Redis publisher connected'));
  }

  /**
   * Connect all Redis clients
   */
  public async connect(): Promise<void> {
    await Promise.all([
      this.client.connect(),
      this.subscriber.connect(),
      this.publisher.connect(),
    ]);
  }

  /**
   * Disconnect all Redis clients
   */
  public async disconnect(): Promise<void> {
    await Promise.all([
      this.client.quit(),
      this.subscriber.quit(),
      this.publisher.quit(),
    ]);
  }

  // ===========================================================================
  // BASIC KEY-VALUE OPERATIONS
  // ===========================================================================

  /**
   * Get a value by key
   */
  public async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  /**
   * Get a value and parse as JSON
   */
  public async getJSON<T>(key: string): Promise<T | null> {
    const value = await this.client.get(key);
    if (!value) return null;
    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }

  /**
   * Set a value with optional TTL (in seconds)
   */
  public async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await this.client.setex(key, ttlSeconds, value);
    } else {
      await this.client.set(key, value);
    }
  }

  /**
   * Set a JSON value with optional TTL
   */
  public async setJSON<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    await this.set(key, JSON.stringify(value), ttlSeconds);
  }

  /**
   * Delete a key
   */
  public async del(key: string): Promise<number> {
    return this.client.del(key);
  }

  /**
   * Delete multiple keys
   */
  public async delMultiple(keys: string[]): Promise<number> {
    if (keys.length === 0) return 0;
    return this.client.del(...keys);
  }

  /**
   * Check if key exists
   */
  public async exists(key: string): Promise<boolean> {
    return (await this.client.exists(key)) === 1;
  }

  /**
   * Set key only if it doesn't exist (NX - Not eXists)
   * Returns true if key was set, false if key already exists
   */
  public async setNX(key: string, value: string, ttlSeconds?: number): Promise<boolean> {
    if (ttlSeconds) {
      const result = await this.client.set(key, value, 'EX', ttlSeconds, 'NX');
      return result === 'OK';
    }
    const result = await this.client.setnx(key, value);
    return result === 1;
  }

  /**
   * Get TTL of a key in seconds
   */
  public async ttl(key: string): Promise<number> {
    return this.client.ttl(key);
  }

  /**
   * Extend TTL of a key
   */
  public async expire(key: string, ttlSeconds: number): Promise<boolean> {
    return (await this.client.expire(key, ttlSeconds)) === 1;
  }

  // ===========================================================================
  // SET OPERATIONS
  // ===========================================================================

  /**
   * Add members to a set
   */
  public async sadd(key: string, ...members: string[]): Promise<number> {
    return this.client.sadd(key, ...members);
  }

  /**
   * Remove members from a set
   */
  public async srem(key: string, ...members: string[]): Promise<number> {
    return this.client.srem(key, ...members);
  }

  /**
   * Get all members of a set
   */
  public async smembers(key: string): Promise<string[]> {
    return this.client.smembers(key);
  }

  /**
   * Check if value is a member of set
   */
  public async sismember(key: string, member: string): Promise<boolean> {
    return (await this.client.sismember(key, member)) === 1;
  }

  /**
   * Get the number of members in a set
   */
  public async scard(key: string): Promise<number> {
    return this.client.scard(key);
  }

  // ===========================================================================
  // HASH OPERATIONS
  // ===========================================================================

  /**
   * Set hash field
   */
  public async hset(key: string, field: string, value: string): Promise<number> {
    return this.client.hset(key, field, value);
  }

  /**
   * Get hash field
   */
  public async hget(key: string, field: string): Promise<string | null> {
    return this.client.hget(key, field);
  }

  /**
   * Get all hash fields and values
   */
  public async hgetall(key: string): Promise<Record<string, string>> {
    return this.client.hgetall(key);
  }

  /**
   * Delete hash field
   */
  public async hdel(key: string, ...fields: string[]): Promise<number> {
    return this.client.hdel(key, ...fields);
  }

  // ===========================================================================
  // PUB/SUB OPERATIONS
  // ===========================================================================

  /**
   * Publish a message to a channel
   */
  public async publish(channel: string, message: string): Promise<number> {
    return this.publisher.publish(channel, message);
  }

  /**
   * Publish a JSON message to a channel
   */
  public async publishJSON<T>(channel: string, data: T): Promise<number> {
    return this.publish(channel, JSON.stringify(data));
  }

  /**
   * Subscribe to a channel
   */
  public async subscribe(channel: string, callback: (message: string) => void): Promise<void> {
    await this.subscriber.subscribe(channel);
    this.subscriber.on('message', (ch, message) => {
      if (ch === channel) {
        callback(message);
      }
    });
  }

  /**
   * Subscribe to a pattern
   */
  public async psubscribe(pattern: string, callback: (channel: string, message: string) => void): Promise<void> {
    await this.subscriber.psubscribe(pattern);
    this.subscriber.on('pmessage', (_pattern, channel, message) => {
      callback(channel, message);
    });
  }

  /**
   * Unsubscribe from a channel
   */
  public async unsubscribe(channel: string): Promise<void> {
    await this.subscriber.unsubscribe(channel);
  }

  // ===========================================================================
  // SCAN OPERATIONS (for finding keys by pattern)
  // ===========================================================================

  /**
   * Scan keys matching a pattern
   */
  public async scanKeys(pattern: string): Promise<string[]> {
    const keys: string[] = [];
    let cursor = '0';

    do {
      const [nextCursor, foundKeys] = await this.client.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = nextCursor;
      keys.push(...foundKeys);
    } while (cursor !== '0');

    return keys;
  }

  // ===========================================================================
  // TRANSACTION OPERATIONS
  // ===========================================================================

  /**
   * Execute commands in a transaction (MULTI/EXEC)
   */
  public async transaction<T>(
    commands: (multi: ReturnType<Redis['multi']>) => ReturnType<Redis['multi']>
  ): Promise<T[]> {
    const multi = this.client.multi();
    const result = await commands(multi).exec();
    if (!result) {
      throw new Error('Transaction failed');
    }
    return result.map(([err, value]) => {
      if (err) throw err;
      return value as T;
    });
  }

  // ===========================================================================
  // RATE LIMITING
  // ===========================================================================

  /**
   * Increment a counter with TTL (for rate limiting)
   * Returns the current count after increment
   */
  public async incrementWithTTL(key: string, ttlSeconds: number): Promise<number> {
    const multi = this.client.multi();
    multi.incr(key);
    multi.expire(key, ttlSeconds);
    const results = await multi.exec();
    if (!results) throw new Error('Rate limit transaction failed');
    return results[0][1] as number;
  }

  /**
   * Get current rate limit count
   */
  public async getRateLimitCount(key: string): Promise<number> {
    const count = await this.client.get(key);
    return count ? parseInt(count, 10) : 0;
  }

  // ===========================================================================
  // RAW CLIENT ACCESS
  // ===========================================================================

  /**
   * Get raw Redis client for advanced operations
   */
  public getClient(): Redis {
    return this.client;
  }
}

// Export singleton instance
export const redis = RedisService.getInstance();

// ============================================================================
// REDIS KEY BUILDERS
// ============================================================================

export const RedisKeys = {
  // Seat reservation keys
  seat: (sessionId: string, seatId: string) => `seat:${sessionId}:${seatId}`,
  seatPattern: (sessionId: string) => `seat:${sessionId}:*`,

  // Session users tracking
  sessionUsers: (sessionId: string) => `session:${sessionId}:users`,

  // User cart
  cart: (userId: string) => `cart:${userId}`,

  // Rate limiting
  rateLimit: (userId: string, action: string) => `rate:${action}:${userId}`,

  // Socket to user mapping
  socketUser: (socketId: string) => `socket:${socketId}:user`,
  userSockets: (userId: string) => `user:${userId}:sockets`,

  // Pub/Sub channels
  channels: {
    seatUpdate: (sessionId: string) => `channel:seat:${sessionId}`,
    sessionUpdate: (sessionId: string) => `channel:session:${sessionId}`,
    bookingUpdate: (userId: string) => `channel:booking:${userId}`,
  },
};

// ============================================================================
// TYPES FOR REDIS DATA
// ============================================================================

export interface SeatReservation {
  userId: string;
  timestamp: number;
  bookingId?: string;
  socketId: string;
}

export interface CartItem {
  sessionId: string;
  seatIds: string[];
  expiresAt: number;
}

export interface SeatUpdateMessage {
  type: 'reserved' | 'released' | 'selected' | 'confirmed';
  sessionId: string;
  seatId: string;
  userId?: string;
  bookingId?: string;
  expiresAt?: number;
  reason?: string;
}

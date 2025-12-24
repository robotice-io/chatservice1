import { Redis } from 'ioredis';

let redisClient: Redis | null = null;

export function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
    
    redisClient.on('connect', () => {
      console.log('🔴 Redis connected');
    });

    redisClient.on('error', (err) => {
      console.error('Redis error:', err);
    });
  }
  
  return redisClient;
}

// Session management
export async function setSession(visitorId: string, data: Record<string, unknown>, ttl = 3600) {
  const redis = getRedisClient();
  await redis.setex(`session:${visitorId}`, ttl, JSON.stringify(data));
}

export async function getSession(visitorId: string): Promise<Record<string, unknown> | null> {
  const redis = getRedisClient();
  const data = await redis.get(`session:${visitorId}`);
  return data ? JSON.parse(data) : null;
}

// Rate limiting
export async function checkRateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const redis = getRedisClient();
  const current = await redis.incr(`rate:${key}`);
  
  if (current === 1) {
    await redis.expire(`rate:${key}`, windowSeconds);
  }
  
  return current <= limit;
}

// Typing indicators with auto-expiry
export async function setTyping(conversationId: string, visitorId: string, isTyping: boolean) {
  const redis = getRedisClient();
  const key = `typing:${conversationId}:${visitorId}`;
  
  if (isTyping) {
    await redis.setex(key, 5, '1'); // Auto-expire after 5 seconds
  } else {
    await redis.del(key);
  }
}


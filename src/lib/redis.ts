import { Redis } from '@upstash/redis';

if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
  throw new Error('Redis configuration missing. Please set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN');
}

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

// Cache keys
export const CACHE_KEYS = {
  flag: (key: string) => `flag:${key}`,
  allFlags: () => 'flags:all',
  userBucket: (userKey: string, flagKey: string) => `bucket:${userKey}:${flagKey}`,
} as const;
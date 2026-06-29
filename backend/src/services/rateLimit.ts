import { Redis } from "ioredis";
import { RateLimiterMemory, RateLimiterRedis } from "rate-limiter-flexible";

type LimiterOptions = {
  points: number;
  durationSeconds: number;
  keyPrefix: string;
};

type LimiterConsumeResult = {
  allowed: boolean;
  msBeforeNext: number;
};

const redisUrl = process.env.REDIS_URL;
const redisClient = redisUrl ? new Redis(redisUrl, { enableOfflineQueue: false, maxRetriesPerRequest: 2 }) : null;

if (redisClient) {
  redisClient.on("error", (error: unknown) => {
    console.error("Redis rate limit client error", error);
  });
}

const limiterCache = new Map<string, RateLimiterRedis | RateLimiterMemory>();

export async function consumeRateLimit(key: string, options: LimiterOptions): Promise<LimiterConsumeResult> {
  const limiter = getLimiter(options);

  try {
    await limiter.consume(key, 1);
    return { allowed: true, msBeforeNext: 0 };
  } catch (error) {
    const msBeforeNext = typeof error === "object" && error && "msBeforeNext" in error
      ? Number((error as { msBeforeNext?: number }).msBeforeNext ?? 0)
      : 0;

    return {
      allowed: false,
      msBeforeNext
    };
  }
}

function getLimiter(options: LimiterOptions) {
  const cacheKey = `${options.keyPrefix}:${options.points}:${options.durationSeconds}`;
  const cached = limiterCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const limiter = redisClient
    ? new RateLimiterRedis({
        storeClient: redisClient,
        keyPrefix: options.keyPrefix,
        points: options.points,
        duration: options.durationSeconds
      })
    : new RateLimiterMemory({
        keyPrefix: options.keyPrefix,
        points: options.points,
        duration: options.durationSeconds
      });

  limiterCache.set(cacheKey, limiter);
  return limiter;
}

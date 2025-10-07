import IORedis, { RedisOptions } from 'ioredis';

export function createRedisConnection(): IORedis {
  const url = process.env.REDIS_URL || 'redis://localhost:6379';
  const options: RedisOptions = {
    maxRetriesPerRequest: null, // REQUIRED for BullMQ
    enableReadyCheck: true, // default safe option
  };

  return new IORedis(url, options);
}

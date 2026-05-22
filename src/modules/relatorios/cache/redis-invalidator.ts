import { Inject, Injectable } from '@nestjs/common';
import IORedis from 'ioredis';
import { WinstonLoggerService } from 'src/logging/winston-logger.service';
import { REDIS_CLIENT } from './cache.constants';

@Injectable()
export class RedisInvalidator {
  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: IORedis,
    private readonly logger: WinstonLoggerService,
  ) {}

  async invalidate(
    prefix: string,
    ids: Array<string | bigint | number | null | undefined>,
  ): Promise<void> {
    const keys = ids
      .filter((id): id is string | bigint | number => id != null && id !== '')
      .map((id) => `${prefix}:${String(id)}`);

    if (keys.length === 0) return;

    try {
      await this.redis.del(...keys);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.logger.error(
        `RedisInvalidator failed for prefix=${prefix} (${keys.length} keys): ${error.message}`,
        { stack: error.stack, error },
      );
    }
  }
}

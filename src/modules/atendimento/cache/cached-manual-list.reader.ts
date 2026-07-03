import { Inject, Injectable } from '@nestjs/common';
import IORedis from 'ioredis';
import { WinstonLoggerService } from 'src/logging/winston-logger.service';
import {
  CACHE_KEYS,
  CACHE_LOG_ENABLED,
  CACHE_TTLS,
  REDIS_CLIENT,
} from 'src/cache/cache.constants';
import { AtendimentoComRelatorioManualPageDTO } from '../dto/atendimento-com-relatorio-manual.dto';

// Page-level cache for the manual-relatório list. Takes the loader as a callback
// so it never depends on AtendimentoService (which calls it). The version key
// only covers PNAE-initiated writes; externally-created/edited Demeter rows are
// covered by the TTL alone.
@Injectable()
export class CachedManualListReader {
  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: IORedis,
    private readonly logger: WinstonLoggerService,
  ) {}

  async getOrLoad(
    keyParts: string[],
    loader: () => Promise<AtendimentoComRelatorioManualPageDTO>,
  ): Promise<AtendimentoComRelatorioManualPageDTO> {
    let key: string | null = null;
    try {
      const version =
        (await this.redis.get(CACHE_KEYS.manualListVersion)) ?? '0';
      key = [CACHE_KEYS.manualList, version, ...keyParts].join(':');
    } catch (err) {
      this.logRedisFailure('get-version', err);
    }

    if (key) {
      try {
        const raw = await this.redis.get(key);
        if (raw) {
          const page = JSON.parse(raw) as AtendimentoComRelatorioManualPageDTO;
          if (CACHE_LOG_ENABLED) {
            this.logger.log(`atendimento.manual-list cache hit key=${key}`);
          }
          return page;
        }
      } catch (err) {
        this.logRedisFailure('get', err);
      }
    }

    const page = await loader();

    if (key) {
      try {
        await this.redis.setex(
          key,
          CACHE_TTLS.manualList,
          JSON.stringify(page),
        );
      } catch (err) {
        this.logRedisFailure('setex', err);
      }
    }

    return page;
  }

  // Call from any PNAE mutation that can change manual-list rows.
  async bumpVersion(): Promise<void> {
    try {
      await this.redis.incr(CACHE_KEYS.manualListVersion);
    } catch (err) {
      this.logRedisFailure('incr', err);
    }
  }

  private logRedisFailure(op: string, err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    this.logger.error(`CachedManualListReader.${op} failed: ${error.message}`, {
      stack: error.stack,
      error,
    });
  }
}

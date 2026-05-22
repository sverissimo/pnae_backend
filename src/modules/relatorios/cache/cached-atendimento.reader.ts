import { Inject, Injectable } from '@nestjs/common';
import IORedis from 'ioredis';
import { AtendimentoModel } from 'src/@domain/atendimento/atendimento-model';
import { AtendimentoService } from 'src/modules/atendimento/atendimento.service';
import { WinstonLoggerService } from 'src/logging/winston-logger.service';
import {
  CACHE_KEYS,
  CACHE_LOG_ENABLED,
  CACHE_TTLS,
  REDIS_CLIENT,
} from './cache.constants';

const TOMBSTONE = '__nil__';

@Injectable()
export class CachedAtendimentoReader {
  private readonly inFlight = new Map<string, Promise<AtendimentoModel[]>>();

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: IORedis,
    private readonly atendimentoService: AtendimentoService,
    private readonly logger: WinstonLoggerService,
  ) {}

  async findMany(ids: string[]): Promise<AtendimentoModel[]> {
    const uniqueIds = [...new Set(ids.filter(Boolean))];
    if (uniqueIds.length === 0) return [];

    const flightKey = [...uniqueIds].sort().join(',');
    const existing = this.inFlight.get(flightKey);
    if (existing) return existing;

    const promise = this.runWithCache(uniqueIds).finally(() => {
      this.inFlight.delete(flightKey);
    });
    this.inFlight.set(flightKey, promise);
    return promise;
  }

  private async runWithCache(
    uniqueIds: string[],
  ): Promise<AtendimentoModel[]> {
    const keys = uniqueIds.map((id) => `${CACHE_KEYS.atendimento}:${id}`);

    const mgetStart = Date.now();
    let cached: (string | null)[] = [];
    try {
      cached = await this.redis.mget(...keys);
    } catch (err) {
      this.logRedisFailure('mget', err);
      return this.atendimentoService.findMany(uniqueIds);
    }
    const mgetMs = Date.now() - mgetStart;

    const byId = new Map<string, AtendimentoModel>();
    const missingIds: string[] = [];
    let tombstoned = 0;

    for (let i = 0; i < uniqueIds.length; i++) {
      const raw = cached[i];
      if (!raw) {
        missingIds.push(uniqueIds[i]);
        continue;
      }
      if (raw === TOMBSTONE) {
        tombstoned++;
        continue;
      }
      try {
        byId.set(uniqueIds[i], JSON.parse(raw) as AtendimentoModel);
      } catch (err) {
        this.logRedisFailure('json-parse', err);
        missingIds.push(uniqueIds[i]);
      }
    }

    let upstreamMs = 0;
    if (missingIds.length > 0) {
      const upstreamStart = Date.now();
      const fetched = await this.atendimentoService.findMany(missingIds);
      upstreamMs = Date.now() - upstreamStart;

      const returnedIds = new Set<string>();
      for (const a of fetched) {
        if (a?.id_at_atendimento) {
          const id = String(a.id_at_atendimento);
          byId.set(id, a);
          returnedIds.add(id);
        }
      }

      try {
        const pipeline = this.redis.pipeline();
        for (const a of fetched) {
          if (!a?.id_at_atendimento) continue;
          pipeline.setex(
            `${CACHE_KEYS.atendimento}:${a.id_at_atendimento}`,
            CACHE_TTLS.atendimento,
            JSON.stringify(a),
          );
        }
        for (const id of missingIds) {
          if (!returnedIds.has(id)) {
            pipeline.setex(
              `${CACHE_KEYS.atendimento}:${id}`,
              CACHE_TTLS.atendimento,
              TOMBSTONE,
            );
          }
        }
        await pipeline.exec();
      } catch (err) {
        this.logRedisFailure('setex', err);
      }
    }

    const hits = uniqueIds.length - missingIds.length - tombstoned;
    if (CACHE_LOG_ENABLED) {
      this.logger.log(
        `atendimento.cache hits=${hits} misses=${missingIds.length} tombstoned=${tombstoned} mgetMs=${mgetMs} upstreamMs=${upstreamMs} totalIds=${uniqueIds.length}`,
      );
    }

    return uniqueIds.map((id) => byId.get(id)).filter(Boolean);
  }

  private logRedisFailure(op: string, err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    this.logger.error(
      `CachedAtendimentoReader.${op} failed: ${error.message}`,
      { stack: error.stack, error },
    );
  }
}

import { Inject, Injectable } from '@nestjs/common';
import IORedis from 'ioredis';
import { ProdutorService } from 'src/modules/produtor/produtor.service';
import { ProdutorFindManyOutputDTO } from 'src/modules/produtor/types/produtores.output-dto';
import { WinstonLoggerService } from 'src/logging/winston-logger.service';
import {
  CACHE_KEYS,
  CACHE_LOG_ENABLED,
  CACHE_TTLS,
  REDIS_CLIENT,
} from './cache.constants';

@Injectable()
export class CachedProdutorReader {
  private readonly inFlight = new Map<
    string,
    Promise<ProdutorFindManyOutputDTO[]>
  >();

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: IORedis,
    private readonly produtorService: ProdutorService,
    private readonly logger: WinstonLoggerService,
  ) {}

  async findManyById(ids: string[]): Promise<ProdutorFindManyOutputDTO[]> {
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
  ): Promise<ProdutorFindManyOutputDTO[]> {
    const keys = uniqueIds.map((id) => `${CACHE_KEYS.produtor}:${id}`);

    const mgetStart = Date.now();
    let cached: (string | null)[] = [];
    try {
      cached = await this.redis.mget(...keys);
    } catch (err) {
      this.logRedisFailure('mget', err);
      return this.produtorService.findManyById(uniqueIds);
    }
    const mgetMs = Date.now() - mgetStart;

    const byId = new Map<string, ProdutorFindManyOutputDTO>();
    const missingIds: string[] = [];

    for (let i = 0; i < uniqueIds.length; i++) {
      const raw = cached[i];
      if (!raw) {
        missingIds.push(uniqueIds[i]);
        continue;
      }
      try {
        byId.set(uniqueIds[i], JSON.parse(raw) as ProdutorFindManyOutputDTO);
      } catch (err) {
        this.logRedisFailure('json-parse', err);
        missingIds.push(uniqueIds[i]);
      }
    }

    let upstreamMs = 0;
    if (missingIds.length > 0) {
      const upstreamStart = Date.now();
      const fetched = await this.produtorService.findManyById(missingIds);
      upstreamMs = Date.now() - upstreamStart;

      for (const p of fetched) {
        if (p?.id_pessoa_demeter) byId.set(String(p.id_pessoa_demeter), p);
      }

      try {
        const pipeline = this.redis.pipeline();
        for (const p of fetched) {
          if (!p?.id_pessoa_demeter) continue;
          pipeline.setex(
            `${CACHE_KEYS.produtor}:${p.id_pessoa_demeter}`,
            CACHE_TTLS.produtor,
            JSON.stringify(p),
          );
        }
        await pipeline.exec();
      } catch (err) {
        this.logRedisFailure('setex', err);
      }
    }

    if (CACHE_LOG_ENABLED) {
      this.logger.log(
        `produtor.cache hits=${uniqueIds.length - missingIds.length} misses=${missingIds.length} mgetMs=${mgetMs} upstreamMs=${upstreamMs} totalIds=${uniqueIds.length}`,
      );
    }

    return uniqueIds.map((id) => byId.get(id)).filter(Boolean);
  }

  private logRedisFailure(op: string, err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    this.logger.error(
      `CachedProdutorReader.${op} failed: ${error.message}`,
      { stack: error.stack, error },
    );
  }
}

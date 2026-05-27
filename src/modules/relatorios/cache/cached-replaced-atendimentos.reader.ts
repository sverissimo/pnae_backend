import { Inject, Injectable } from '@nestjs/common';
import IORedis from 'ioredis';
import { AtendimentoService } from 'src/modules/atendimento/atendimento.service';
import { AtendimentoUpdate } from 'src/@domain/relatorio/types/atendimento-updates';
import { WinstonLoggerService } from 'src/logging/winston-logger.service';
import {
  CACHE_KEYS,
  CACHE_LOG_ENABLED,
  CACHE_TTLS,
  REDIS_CLIENT,
} from './cache.constants';

/**
 * Single-key cache for the atendimento *replacement mapping*
 * (`getReplacedAtendimentos`), which rewrites stale atendimentoIds on
 * relatórios during hydration. This is NOT atendimento-by-id data — it's one
 * whole-list payload with no id to key on, so it doesn't belong in
 * CachedAtendimentoReader.
 *
 * Used ONLY by the web hot path (`findAll` with `expand: true` →
 * `/relatorios/all`, `/relatorios/dashboard`). Mobile reaches the same
 * mapping through `RelatorioService.findMany` (GET /relatorios?produtorId=…),
 * which deliberately stays on the live REST path so the shipped mobile
 * contract observes no value drift. Keep this reader off any mobile route.
 *
 * TTL-only invalidation; replacements originate upstream (external REST), not
 * from our mutations, so there's nothing local to bust.
 */
@Injectable()
export class CachedReplacedAtendimentosReader {
  private inFlight: Promise<AtendimentoUpdate[]> | null = null;

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: IORedis,
    private readonly atendimentoService: AtendimentoService,
    private readonly logger: WinstonLoggerService,
  ) {}

  async get(): Promise<AtendimentoUpdate[]> {
    if (this.inFlight) return this.inFlight;
    const promise = this.runWithCache().finally(() => {
      this.inFlight = null;
    });
    this.inFlight = promise;
    return promise;
  }

  private async runWithCache(): Promise<AtendimentoUpdate[]> {
    const key = CACHE_KEYS.replacedAtendimentos;

    try {
      const cached = await this.redis.get(key);
      if (cached) {
        if (CACHE_LOG_ENABLED) this.logger.log('replacedAtendimentos.cache hit');
        return JSON.parse(cached) as AtendimentoUpdate[];
      }
    } catch (err) {
      this.logRedisFailure('get', err);
      return this.fetchLive();
    }

    const upstreamStart = Date.now();
    const fetched = await this.fetchLive();
    const upstreamMs = Date.now() - upstreamStart;

    try {
      await this.redis.setex(
        key,
        CACHE_TTLS.replacedAtendimentos,
        JSON.stringify(fetched),
      );
    } catch (err) {
      this.logRedisFailure('setex', err);
    }

    if (CACHE_LOG_ENABLED) {
      this.logger.log(
        `replacedAtendimentos.cache miss count=${fetched.length} upstreamMs=${upstreamMs}`,
      );
    }
    return fetched;
  }

  private async fetchLive(): Promise<AtendimentoUpdate[]> {
    return (await this.atendimentoService.getReplacedAtendimentos()) as AtendimentoUpdate[];
  }

  private logRedisFailure(op: string, err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    this.logger.error(
      `CachedReplacedAtendimentosReader.${op} failed: ${error.message}`,
      { stack: error.stack, error },
    );
  }
}

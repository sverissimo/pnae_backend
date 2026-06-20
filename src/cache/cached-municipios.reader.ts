import { Inject, Injectable } from '@nestjs/common';
import IORedis from 'ioredis';
import { RestAPI } from 'src/@rest-api-server/rest-api.service';
import { WinstonLoggerService } from 'src/logging/winston-logger.service';
import { CACHE_KEYS, CACHE_TTLS, REDIS_CLIENT } from './cache.constants';

/**
 * Caches the canonical `getMunicipiosEmater` table as a unit→regional map
 * (`id_und_empresa` "H…" → `regional_id` "G…"). Slow-changing, so a single
 * long-TTL blob with in-flight dedup (mirrors PerfilService's regionais cache).
 */
@Injectable()
export class CachedMunicipiosReader {
  private inFlight: Promise<Map<string, string>> | null = null;

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: IORedis,
    private readonly restAPI: RestAPI,
    private readonly logger: WinstonLoggerService,
  ) {}

  async getUnidadeToRegionalMap(): Promise<Map<string, string>> {
    if (this.inFlight) return this.inFlight;
    this.inFlight = this.load().finally(() => {
      this.inFlight = null;
    });
    return this.inFlight;
  }

  private async load(): Promise<Map<string, string>> {
    const key = CACHE_KEYS.municipiosEmater;

    let raw: string | null = null;
    try {
      raw = await this.redis.get(key);
    } catch (err) {
      this.logRedisFailure('get', err);
    }
    if (raw) {
      try {
        return new Map(JSON.parse(raw) as [string, string][]);
      } catch (err) {
        this.logRedisFailure('json-parse', err);
      }
    }

    const municipios = (await this.restAPI.getMunicipiosEmater()) ?? [];
    const entries: [string, string][] = municipios
      .filter((m) => !!m?.id_und_empresa && !!m?.regional_id)
      .map((m) => [String(m.id_und_empresa), String(m.regional_id)]);

    try {
      await this.redis.setex(
        key,
        CACHE_TTLS.municipiosEmater,
        JSON.stringify(entries),
      );
    } catch (err) {
      this.logRedisFailure('setex', err);
    }

    return new Map(entries);
  }

  private logRedisFailure(op: string, err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    this.logger.error(`CachedMunicipiosReader.${op} failed: ${error.message}`, {
      stack: error.stack,
      error,
    });
  }
}

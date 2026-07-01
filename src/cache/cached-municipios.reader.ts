import { Inject, Injectable } from '@nestjs/common';
import IORedis from 'ioredis';
import { RestAPI } from 'src/@rest-api-server/rest-api.service';
import { MunicipioEmater } from 'src/@rest-api-server/types/municipio-emater';
import { WinstonLoggerService } from 'src/logging/winston-logger.service';
import { CACHE_KEYS, CACHE_TTLS, REDIS_CLIENT } from './cache.constants';

export type UnidadeLocalidade = {
  nomeMunicipio: string | null;
  id_reg_empresa: string | null;
  nomeRegional: string | null;
};

@Injectable()
export class CachedMunicipiosReader {
  private inFlight: Promise<MunicipioEmater[]> | null = null;

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: IORedis,
    private readonly restAPI: RestAPI,
    private readonly logger: WinstonLoggerService,
  ) {}

  async getUnidadeToRegionalMap(): Promise<Map<string, string>> {
    const municipios = await this.loadAll();
    const entries: [string, string][] = municipios
      .filter((m) => !!m?.id_und_empresa && !!m?.regional_id)
      .map((m) => [String(m.id_und_empresa), String(m.regional_id)]);

    return new Map(entries);
  }

  async getUnidadeToLocalidadeMap(): Promise<Map<string, UnidadeLocalidade>> {
    const municipios = await this.loadAll();
    const entries: [string, UnidadeLocalidade][] = municipios
      .filter((m) => !!m?.id_und_empresa)
      .map((m) => [
        String(m.id_und_empresa),
        {
          nomeMunicipio: m.nome_municipio ?? null,
          id_reg_empresa: m.regional_id ? String(m.regional_id) : null,
          nomeRegional: m.nome_regional ?? null,
        },
      ]);

    return new Map(entries);
  }

  private async loadAll(): Promise<MunicipioEmater[]> {
    if (this.inFlight) return this.inFlight;
    this.inFlight = this.load().finally(() => {
      this.inFlight = null;
    });
    return this.inFlight;
  }

  private async load(): Promise<MunicipioEmater[]> {
    const key = CACHE_KEYS.municipiosEmater;

    let raw: string | null = null;
    try {
      raw = await this.redis.get(key);
    } catch (err) {
      this.logRedisFailure('get', err);
    }
    if (raw) {
      try {
        return JSON.parse(raw) as MunicipioEmater[];
      } catch (err) {
        this.logRedisFailure('json-parse', err);
      }
    }

    const municipios = (await this.restAPI.getMunicipiosEmater()) ?? [];

    try {
      await this.redis.setex(
        key,
        CACHE_TTLS.municipiosEmater,
        JSON.stringify(municipios),
      );
    } catch (err) {
      this.logRedisFailure('setex', err);
    }

    return municipios;
  }

  private logRedisFailure(op: string, err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    this.logger.error(`CachedMunicipiosReader.${op} failed: ${error.message}`, {
      stack: error.stack,
      error,
    });
  }
}

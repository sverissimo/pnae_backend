import { Inject, Injectable } from '@nestjs/common';
import IORedis from 'ioredis';
import { UpdatePerfilDto } from '../../@domain/perfil/dto/update-perfil.dto';
import { PerfilGraphQLAPI } from 'src/@graphQL-server/perfil-api.service';
import { RestAPI } from 'src/@rest-api-server/rest-api.service';
import { Perfil } from '../../@domain/perfil';
import { CreatePerfilInputDto } from 'src/@domain/perfil/dto/create-perfil.dto';
import { PerfilDataMapper } from './data-mapper/perfil.data-mapper';
import { WinstonLoggerService } from 'src/logging/winston-logger.service';
import {
  CACHE_KEYS,
  CACHE_LOG_ENABLED,
  CACHE_TTLS,
  REDIS_CLIENT,
} from 'src/cache/cache.constants';

type RegionalEmater = {
  nm_und_empresa: string;
  sg_und_empresa: string | null;
  id_und_empresa: string;
};

@Injectable()
export class PerfilService {
  private inFlightRegionais: Promise<RegionalEmater[]> | null = null;

  constructor(
    private graphQLAPI: PerfilGraphQLAPI,
    private restAPI: RestAPI,
    @Inject(REDIS_CLIENT) private readonly redis: IORedis,
    private readonly logger: WinstonLoggerService,
  ) {}

  async create(createPerfilInputDto: CreatePerfilInputDto) {
    const perfilOptionsRaw = await this.getPerfilOptionsRaw();

    const createPerfilOutputDTO = new Perfil(
      createPerfilInputDto,
    ).inputDTOToOutputDTO();

    PerfilDataMapper.convertStringPropsToPrimeNumbers(
      createPerfilOutputDTO,
      perfilOptionsRaw,
    );

    const result = this.graphQLAPI.createPerfil(createPerfilOutputDTO);

    return result;
  }

  async findAll() {
    const perfis = await this.graphQLAPI.getPerfis();
    return perfis;
  }

  async update(id: number, updatePerfilDto: UpdatePerfilDto) {
    return await this.graphQLAPI.updatePerfil(id, updatePerfilDto);
  }

  async remove(id: number) {
    return await this.graphQLAPI.deletePerfil(id);
  }

  getPerfilOptions = async () => {
    const data = await this.restAPI.getPerfilOptions();
    return data;
  };

  getPerfilOptionsRaw = () => this.restAPI.getPerfilOptionsRaw();

  getProdutos = async () => {
    const produtos = await this.restAPI.getGruposProdutos();
    return produtos;
  };

  getContractInfo = async () => {
    const contractInfo = await this.restAPI.getContractInfo();
    return contractInfo;
  };

  getRegionaisEmater = async (): Promise<RegionalEmater[]> => {
    if (this.inFlightRegionais) return this.inFlightRegionais;

    this.inFlightRegionais = this.loadRegionaisEmater().finally(() => {
      this.inFlightRegionais = null;
    });
    return this.inFlightRegionais;
  };

  private async loadRegionaisEmater(): Promise<RegionalEmater[]> {
    const key = CACHE_KEYS.regionaisEmater;

    const getStart = Date.now();
    let raw: string | null = null;
    try {
      raw = await this.redis.get(key);
    } catch (err) {
      this.logRedisFailure('get', err);
    }
    const getMs = Date.now() - getStart;

    if (raw) {
      try {
        const parsed = JSON.parse(raw) as RegionalEmater[];
        if (CACHE_LOG_ENABLED) {
          this.logger.log(
            `regionais.cache hit=1 getMs=${getMs} upstreamMs=0 count=${parsed.length}`,
          );
        }
        return parsed;
      } catch (err) {
        this.logRedisFailure('json-parse', err);
      }
    }

    const upstreamStart = Date.now();
    const unidadesEmpresa = (await this.restAPI.getRegionaisEmater()) as Array<{
      sg_und_empresa: string | null;
      id_und_empresa: string;
      nm_und_empresa: string;
    }>;
    const upstreamMs = Date.now() - upstreamStart;

    const mapped: RegionalEmater[] = unidadesEmpresa.map((r) => ({
      nm_und_empresa: r.nm_und_empresa,
      sg_und_empresa: r.sg_und_empresa,
      id_und_empresa: r.id_und_empresa,
    }));

    try {
      await this.redis.setex(
        key,
        CACHE_TTLS.regionaisEmater,
        JSON.stringify(mapped),
      );
    } catch (err) {
      this.logRedisFailure('setex', err);
    }

    if (CACHE_LOG_ENABLED) {
      this.logger.log(
        `regionais.cache hit=0 getMs=${getMs} upstreamMs=${upstreamMs} count=${mapped.length}`,
      );
    }
    return mapped;
  }

  private logRedisFailure(op: string, err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    this.logger.error(
      `PerfilService.regionais.cache.${op} failed: ${error.message}`,
      { stack: error.stack, error },
    );
  }
}

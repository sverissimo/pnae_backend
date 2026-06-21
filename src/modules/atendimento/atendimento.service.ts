import * as fs from 'fs/promises';
import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateAtendimentoInputDto } from './dto/create-atendimento.dto';
import { UpdateAtendimentoStorageDto } from './dto/update-atendimento.dto';
import { AtendimentoGraphQLAPI } from 'src/@graphQL-server/atendimento-api.service';
import { Atendimento } from './entities/atendimento.entity';
import { RestAPI } from 'src/@rest-api-server/rest-api.service';
import { AtendimentoDataMapper } from './data-mapper/atendimento.data-mapper';
import { UpdateTemasAndVisitaAtendimentoDTO } from './dto/update-temas-and-visita-atendimento.dto';
import { AtendimentoModel } from 'src/@domain/atendimento/atendimento-model';
import { RedisInvalidator } from 'src/cache/redis-invalidator';
import { CACHE_KEYS } from 'src/cache/cache.constants';
import { CachedMunicipiosReader } from 'src/cache/cached-municipios.reader';
import { AtendimentoAuthScope } from 'src/@domain/atendimento/atendimento-auth-scope';

@Injectable()
export class AtendimentoService {
  constructor(
    private graphQLAPI: AtendimentoGraphQLAPI,
    private restAPI: RestAPI,
    private readonly redisInvalidator: RedisInvalidator,
    private readonly cachedMunicipiosReader: CachedMunicipiosReader,
  ) {}

  async create(CreateAtendimentoInputDto: CreateAtendimentoInputDto) {
    const atendimento = Atendimento.create(CreateAtendimentoInputDto);
    const createAtendimentoStorageDto =
      AtendimentoDataMapper.entityToCreateStorageDto(atendimento);

    const newAtendimentoId: string = await this.graphQLAPI.createAtendimento(
      createAtendimentoStorageDto,
    );
    return newAtendimentoId;
  }

  async findMany(ids: string[]): Promise<AtendimentoModel[]> {
    const atendimentos = await this.graphQLAPI.findMany(ids);
    const parsedAtendimentos = atendimentos.map((atendimento) => {
      const { at_atendimento_usuario } = atendimento;
      const usuario = at_atendimento_usuario?.[0]?.usuario;

      return {
        ...atendimento,
        usuario: usuario?.nome_usuario,
        at_atendimento_usuario: undefined,
      };
    });
    return parsedAtendimentos;
  }

  async findOne(id: string) {
    const atendimento = await this.graphQLAPI.findOne(id);
    const { at_cli_atend_prop, at_atendimento_usuario } = atendimento;
    atendimento.at_cli_atend_prop = at_cli_atend_prop && at_cli_atend_prop[0];
    atendimento.at_atendimento_usuario =
      at_atendimento_usuario && at_atendimento_usuario[0];
    return atendimento;
  }

  async updateIfNecessary(atendimentoId: string, numero_relatorio: string) {
    const atendimento = await this.findOne(atendimentoId);
    if (!atendimento?.sn_pendencia) {
      return;
    }

    const {
      id_und_empresa,
      link_pdf,
      at_cli_atend_prop,
      at_atendimento_usuario,
    } = atendimento;
    const { id_usuario } = at_atendimento_usuario;
    const { id_pessoa_demeter, id_pl_propriedade } = at_cli_atend_prop;

    const atendimentoDTO: CreateAtendimentoInputDto = {
      id_usuario,
      id_und_empresa,
      link_pdf,
      id_pessoa_demeter,
      id_pl_propriedade,
      numero_relatorio,
      id_at_anterior: atendimentoId,
    };

    await this.logicRemove(atendimentoId);
    const newAtendimento = Atendimento.recreate(atendimentoDTO);
    const newAtendimentoDto =
      AtendimentoDataMapper.entityToCreateStorageDto(newAtendimento);

    const newAtendimentoId =
      await this.graphQLAPI.createAtendimento(newAtendimentoDto);

    return newAtendimentoId;
  }

  async update(
    id: string,
    UpdateAtendimentoInputDto: UpdateAtendimentoStorageDto,
  ) {
    await this.graphQLAPI.update({
      id_at_atendimento: id,
      ...UpdateAtendimentoInputDto,
    });
    await this.redisInvalidator.invalidate(CACHE_KEYS.atendimento, [id]);
  }

  async updateTemasAndVisita({
    atendimentoId,
    temasAtendimento,
    numeroVisita,
  }: UpdateTemasAndVisitaAtendimentoDTO): Promise<void> {
    if (!atendimentoId || (!temasAtendimento && !numeroVisita)) return;

    const parsedTemas = Array.isArray(temasAtendimento)
      ? temasAtendimento.join(',').trim()
      : temasAtendimento;

    const isValidTema = (tema: string) =>
      !!tema &&
      typeof tema === 'string' &&
      tema.trim() !== '' &&
      tema !== 'undefined';

    const temas = isValidTema(parsedTemas)
      ? Atendimento.temasAtendimentoListToDTO(parsedTemas)
      : undefined;

    const numero =
      !numeroVisita ||
      (typeof numeroVisita === 'string' && numeroVisita.trim() === '')
        ? undefined
        : numeroVisita;

    await this.restAPI.updateTemasAndVisitaAtendimento({
      atendimentoId,
      temasAtendimento: temas,
      numeroVisita: numero,
    });
    await this.redisInvalidator.invalidate(CACHE_KEYS.atendimento, [
      atendimentoId,
    ]);
  }

  async aprovarAtendimento(atendimentoId: string): Promise<void> {
    await this.validarAtendimento(atendimentoId, () =>
      this.restAPI.aprovarAtendimento(atendimentoId),
    );
  }

  async criarPendenciaAtendimento(atendimentoId: string): Promise<void> {
    await this.validarAtendimento(atendimentoId, () =>
      this.restAPI.criarPendenciaAtendimento(atendimentoId),
    );
  }

  async aprovarSei(atendimentoId: string): Promise<void> {
    await this.validarAtendimento(atendimentoId, () =>
      this.restAPI.aprovarSei(atendimentoId),
    );
  }

  async removerAprovacaoSei(atendimentoId: string): Promise<void> {
    await this.validarAtendimento(atendimentoId, () =>
      this.restAPI.removerAprovacaoSei(atendimentoId),
    );
  }

  private async validarAtendimento(
    atendimentoId: string,
    action: () => Promise<void>,
  ): Promise<void> {
    if (!atendimentoId)
      throw new BadRequestException('atendimentoId é obrigatório.');

    await action();
    await this.redisInvalidator.invalidate(CACHE_KEYS.atendimento, [
      atendimentoId,
    ]);
  }

  // Single source for atendimento authorization: resolves the normalized
  // { ownerId, regionId } from the external atendimento (its PK), so it serves
  // both relatório-backed and relatório-less atendimentos. A missing/invalid id
  // yields an empty scope, which denies every non-admin via hasAccessTo.
  async getAtendimentoAuthScope(
    atendimentoId: string,
  ): Promise<AtendimentoAuthScope> {
    if (!atendimentoId) return { ownerId: null, regionId: null };

    let atendimento: Awaited<ReturnType<typeof this.findOne>> | null = null;
    try {
      atendimento = await this.findOne(atendimentoId);
    } catch {
      return { ownerId: null, regionId: null };
    }
    if (!atendimento) return { ownerId: null, regionId: null };

    const ownerId = atendimento.at_atendimento_usuario?.id_usuario ?? null;
    const regionId = await this.resolveRegionalId(atendimento.id_und_empresa);
    return { ownerId: ownerId != null ? String(ownerId) : null, regionId };
  }

  // The atendimento carries a unit id ("H…" local or "G…" regional); Usuario
  // carries the regional ("G…"). Map H→G via the cached municipios table.
  private async resolveRegionalId(
    unidadeEmpresaId?: string | null,
  ): Promise<string | null> {
    if (!unidadeEmpresaId) return null;
    if (unidadeEmpresaId.startsWith('G')) return unidadeEmpresaId;
    const map = await this.cachedMunicipiosReader.getUnidadeToRegionalMap();
    return map.get(unidadeEmpresaId) ?? null;
  }

  async setAtendimentosExportDate(atendimentos: Partial<AtendimentoModel>[]) {
    const shouldSetExportDate = atendimentos.filter((atendimento) => {
      return !atendimento.dt_export_ok;
    });

    if (!shouldSetExportDate.length) return;

    const ids = shouldSetExportDate.map(
      (atendimento) => atendimento.id_at_atendimento,
    );
    await this.graphQLAPI.setAtendimentosExportDate(ids);
    await this.redisInvalidator.invalidate(CACHE_KEYS.atendimento, ids);
  }

  async saveIdsToFile(atendimentosIds: string[]) {
    const zipPath = process.env.ZIP_FILES_PATH;
    await fs.writeFile(
      `${zipPath}/atendimentosIds.json`,
      JSON.stringify(atendimentosIds),
    );
  }

  async logicRemove(id: string) {
    if (!id) return;
    await this.update(id, { ativo: false });
  }

  // Workaround cause frontEnd doesn't send dates
  async fixDatesIfNeeded({
    createdAt,
    atendimentoId,
  }: {
    createdAt: string;
    atendimentoId: string;
  }) {
    if (!createdAt || !atendimentoId) return false;

    const atendimento = await this.findOne(atendimentoId);
    const { data_inicio_atendimento } = atendimento;

    const parsedCreated = new Date(createdAt);
    const parsedInicio = new Date(data_inicio_atendimento);
    const validCreated = !isNaN(parsedCreated.getTime());
    const validInicio = !isNaN(parsedInicio.getTime());

    if (!validInicio && validCreated) {
      await this.update(atendimentoId, {
        data_inicio_atendimento: createdAt,
        data_fim_atendimento: createdAt,
      });
      return true;
    }

    if (!validCreated || !validInicio) return false;

    const d1 = parsedCreated.toISOString().slice(0, 10);
    const d2 = parsedInicio.toISOString().slice(0, 10);

    if (d1 !== d2) {
      console.log('Dates are different, updating atendimento...');
      await this.update(atendimentoId, {
        data_inicio_atendimento: createdAt,
        data_fim_atendimento: createdAt,
      });
      return true;
    }

    return false;
  }

  getReplacedAtendimentos() {
    return this.restAPI.getReplacedAtendimentos();
  }
}

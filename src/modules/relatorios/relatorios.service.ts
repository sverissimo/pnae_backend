import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from 'src/prisma/generated/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { FileService } from 'src/modules/files/file.service';
import { RestAPI } from 'src/@rest-api-server/rest-api.service';
import { Relatorio } from 'src/@domain/relatorio/relatorio';
import { RelatorioDto } from './dto/relatorio.dto';
import { RelatorioModel } from 'src/@domain/relatorio/relatorio-model';
import { AtendimentoService } from '../atendimento/atendimento.service';
import { UpdateRelatorioDto } from './dto/update-relatorio.dto';
import { AtendimentoUpdate } from 'src/@domain/relatorio/types/atendimento-updates';
import { RelatorioDomainService } from 'src/@domain/relatorio/relatorio-domain-service';
import { WinstonLoggerService } from 'src/logging/winston-logger.service';
import { UpdateTemasAndVisitaAtendimentoDTO } from '../atendimento/dto/update-temas-and-visita-atendimento.dto';
import { FilesInputDto } from 'src/modules/files/files-input.dto';
import { Usuario } from '../../@domain/usuario/usuario.entity';
import { RelatorioDataMapper } from './data-mapper/relatorio.data-mapper';
import { ProdutorModel } from 'src/@domain/produtor/produtor-model';
import { CachedProdutorReader } from '../produtor/cache/cached-produtor.reader';
import { CachedAtendimentoReader } from '../atendimento/cache/cached-atendimento.reader';

import { UsuarioGraphQLAPI } from 'src/@graphQL-server/usuario-api.service';
import { RelatorioPresentationModel } from './dto/relatorio.presentation-model';
import {
  buildDashboardData,
  DashboardData,
} from 'src/@domain/relatorio/relatorio-dashboard-stats';
import { PerfilService } from '../perfil/perfil.service';
import { CachedReplacedAtendimentosReader } from '../atendimento/cache/cached-replaced-atendimentos.reader';

type queryObject = { ids?: string[]; produtorIds?: string[] };

@Injectable()
export class RelatorioService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly atendimentoService: AtendimentoService,
    private readonly fileService: FileService,
    private readonly restAPI: RestAPI,
    private readonly logger: WinstonLoggerService,
    private readonly perfilService: PerfilService,
    private readonly cachedProdutorReader: CachedProdutorReader,
    private readonly cachedAtendimentoReader: CachedAtendimentoReader,
    private readonly cachedReplacedAtendimentosReader: CachedReplacedAtendimentosReader,
    private readonly usuarioApi: UsuarioGraphQLAPI,
  ) {}

  async create(relatorioInput: RelatorioModel, files?: FilesInputDto) {
    await this.checkForDuplicateRelatorios(relatorioInput);

    try {
      const relatorioDto = new Relatorio(relatorioInput).toDto();
      const createdRelatorio = await this.prismaService.relatorio.create({
        data: relatorioDto,
      });
      void this.fixAtendimentoDate(relatorioInput);
      await this.handleFileSave(files, createdRelatorio); // if throws, orientacao is saved, can add files later
      return createdRelatorio;
    } catch (error: any) {
      await this.rollbackAtendimento(relatorioInput.atendimentoId);
      this.handlePersistenceError(error);
    }
  }

  private async handleFileSave(files: FilesInputDto, created: any) {
    if (!files || Object.keys(files).length === 0) return;
    try {
      await this.fileService.save(files, created);
    } catch (fileErr: any) {
      this.logger.error(
        `Falha ao salvar arquivos do relatório ${created.id}: ${fileErr.message}`,
        { stack: fileErr.stack, error: fileErr },
      );
      throw fileErr;
    }
  }

  private async rollbackAtendimento(atendimentoId?: string) {
    if (!atendimentoId) return;
    try {
      await this.atendimentoService.logicRemove(atendimentoId);
    } catch (rollbackErr: any) {
      this.logger.error(
        `Rollback (logicRemove) failed for atendimento ${atendimentoId}: ${rollbackErr.message}`,
        { stack: rollbackErr.stack, error: rollbackErr },
      );
    }
  }

  async createMany(relatorios: RelatorioModel[]) {
    if (!Array.isArray(relatorios) || relatorios.length === 0) {
      return 'Nenhum relatório para criar';
    }

    const data = relatorios.map((r) => new Relatorio(r).toDto());

    await this.prismaService.relatorio.createMany({
      data,
      skipDuplicates: true,
    });
    return 'Relatórios criados com sucesso';
  }

  async findOne(id: string) {
    const relatorio = await this.prismaService.relatorio.findUnique({
      where: { id: id },
    });

    if (!relatorio) throw new NotFoundException('Nenhum relatório encontrado');
    return relatorio;
  }

  async findMany(input: queryObject | string | string[]) {
    let query = {};
    if (typeof input === 'string') {
      query = { produtorId: { in: [BigInt(input)] } };
    } else if (Array.isArray(input)) {
      query = { produtorId: { in: input.map((id) => BigInt(id)) } };
    } else if (input.ids || input.produtorIds) {
      const produtorIds = input?.produtorIds?.map((id) => BigInt(id)) || [];
      query = {
        OR: [
          { id: { in: input?.ids || [] } },
          { produtorId: { in: produtorIds } },
        ],
      };
    }

    const relatorios = await this.prismaService.relatorio.findMany({
      where: query,
    });

    const relatoriosWithReadOnly = (
      await this.setRelatoriosReadOnlyStatus(relatorios)
    ).map(Relatorio.toModel);

    const relatoriosResolvedAtendimentos = this.updateAtendimentoIds(
      relatoriosWithReadOnly,
    );

    return relatoriosResolvedAtendimentos || relatoriosWithReadOnly;
  }

  async getDashboardData(user?: Usuario): Promise<DashboardData> {
    const role = user?.getRole() ?? 'other';

    const [fullRelatorios, regionais] = await Promise.all([
      this.findAll({ contratoId: 2 }, { expand: true }) as Promise<
        RelatorioPresentationModel[]
      >,
      this.perfilService.getRegionaisEmater(),
    ]);

    // Scoped set drives gauges + line chart; tops + by-regional use the full set.
    const scoped = this.scopeRelatoriosForUser(fullRelatorios, user);
    const regionalLabel = this.resolveRegionalLabel(scoped);

    return buildDashboardData({
      fullRelatorios: fullRelatorios ?? [],
      scopedRelatorios: scoped,
      regionais: regionais ?? [],
      role,
      regionalLabel,
      topTecnicosLimit: 100,
      topSREsLimit: 10,
    });
  }

  // Dashboard-only scoping: gauges/line chart reflect the user's *regional*,
  // not just their own relatorios. See AGENTS.md "Authentication flow (mobile vs web)".
  private scopeRelatoriosForUser(
    relatorios: RelatorioPresentationModel[],
    user?: Usuario,
  ): RelatorioPresentationModel[] {
    if (!user) return [];
    if (user.isAdmin() || user.isDeveloper()) return relatorios;
    if (!user.id_reg_empresa) return [];
    return relatorios.filter((r) => r.id_reg_empresa === user.id_reg_empresa);
  }

  private resolveRegionalLabel(
    scoped: RelatorioPresentationModel[],
  ): string | null {
    const match = scoped.find((r) => r.nm_und_empresa);
    return match?.nm_und_empresa ?? null;
  }

  async getAuthorizedRelatorios(user?: Usuario, expand = false) {
    const filter = await this.createFilter(user);
    const result = await this.findAll(filter, { expand });

    if (!expand || !user || user.isAdmin() || user.isDeveloper()) {
      return result;
    }
    const scopedResult = (result as RelatorioPresentationModel[]).filter((r) =>
      user.hasAccessTo({ ownerId: r.tecnicoId, regionId: r.id_reg_empresa }),
    );
    return scopedResult;
  }

  // Detail/update/remove visibility check: returns the row when visible, else
  // NotFoundException (non-visible and missing are indistinguishable). Never
  // call with an undefined user — mobile bypasses scope at the controller layer.
  async assertCanAccess(id: string, user: Usuario) {
    const row = await this.prismaService.relatorio.findUnique({
      where: { id },
    });
    if (!row) throw new NotFoundException('Nenhum relatório encontrado');

    if (user.isAdmin() || user.isDeveloper()) return row;

    const produtorId = row.produtorId ? String(row.produtorId) : '';
    const [produtor] = produtorId
      ? await this.cachedProdutorReader.findManyById([produtorId])
      : [];

    const visible = user.hasAccessTo({
      ownerId: row.tecnicoId,
      regionId: produtor?.id_reg_empresa,
    });
    if (!visible) throw new NotFoundException('Nenhum relatório encontrado');
    return row;
  }

  async findAll(
    filter: Prisma.RelatorioWhereInput = {},
    options: { expand?: boolean } = {},
  ) {
    const relatorios = await this.prismaService.relatorio.findMany({
      where: filter,
      orderBy: { createdAt: 'desc' },
      ...(options.expand ? { omit: { orientacao: true } } : {}),
    });

    if (!relatorios || relatorios.length === 0) return [];

    const relatorioModels = relatorios.map(Relatorio.toModel);
    // Web hot path (expand) reads the replacement mapping from cache; other
    // callers use the live REST path (see updateAtendimentoIds).
    const updatedRelatorios = await this.updateAtendimentoIds(
      relatorioModels,
      options.expand,
    );
    const parsedRelatorios = updatedRelatorios || relatorioModels;

    if (!options.expand) return parsedRelatorios;
    return this.hydrateRelatorios(parsedRelatorios);
  }

  private async hydrateRelatorios(
    relatorios: RelatorioModel[],
  ): Promise<RelatorioPresentationModel[]> {
    const produtorIds = [
      ...new Set(relatorios.map((r) => r.produtorId).filter(Boolean)),
    ];
    const atendimentoIds = [
      ...new Set(relatorios.map((r) => r.atendimentoId).filter(Boolean)),
    ];
    const tecnicoIds = [
      ...new Set(
        relatorios
          .map((r) => r.tecnicoId)
          .filter(Boolean)
          .map(String),
      ),
    ];

    const [produtores, atendimentos, tecnicoNameById] = await Promise.all([
      this.cachedProdutorReader.findManyById(produtorIds) as unknown as Promise<
        ProdutorModel[]
      >,
      this.cachedAtendimentoReader.findMany(atendimentoIds),
      this.resolveTecnicoNames(tecnicoIds),
    ]);

    return RelatorioDataMapper.manyToPresentationModel({
      relatorios,
      produtores,
      atendimentos: atendimentos,
      tecnicoNameById,
    });
  }

  // our-DB tecnicoId -> técnico name; a directory failure degrades to an empty
  // map so the list still renders (web falls back to the external `usuario` name).
  private async resolveTecnicoNames(
    ids: string[],
  ): Promise<Map<string, string>> {
    if (ids.length === 0) return new Map();
    try {
      const { usuarios } = (await this.usuarioApi.getUsuarios({
        ids: ids.join(','),
      })) as { usuarios: { id_usuario: string; nome_usuario: string }[] };
      return new Map(
        (usuarios || []).map((u) => [String(u.id_usuario), u.nome_usuario]),
      );
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(
        `RelatorioService.resolveTecnicoNames failed: ${err.message}`,
        err.stack,
      );
      return new Map();
    }
  }

  private async createFilter(
    user?: Usuario,
  ): Promise<Prisma.RelatorioWhereInput> {
    if (!user) return { id: 'no-access' };
    if (
      user.isAdmin() ||
      user.isDeveloper() ||
      user.isCoordenadorRegional() ||
      user.isStaff()
    ) {
      return { contratoId: 2 };
    }
    return { id: 'no-access' };
  }

  async update(
    updateInput: UpdateRelatorioDto & { id: string; files?: FilesInputDto },
  ) {
    const [relatorio] = await this.findMany({ ids: [updateInput.id] }); // get updated readOnly and atendimentoId props
    if (!relatorio)
      throw new NotFoundException('Relatório a atualizar não foi encontrado.');
    if (relatorio.readOnly) return;

    const {
      id,
      atendimentoId,
      temas_atendimento,
      readOnly,
      files,
      ...updateData
    } = updateInput;

    const data = Relatorio.updateFieldsToDTO(updateData);
    await this.prismaService.relatorio.update({ where: { id }, data });

    await this.syncAtendimentoTemasAndNumero({
      atendimentoId: relatorio.atendimentoId?.toString(),
      temasAtendimento: temas_atendimento || undefined,
      numeroVisita:
        !!updateInput.numeroRelatorio &&
        !isNaN(Number(updateInput.numeroRelatorio))
          ? String(updateInput.numeroRelatorio)
          : undefined,
      oldRelatorioNumber:
        !!relatorio.numeroRelatorio && !isNaN(Number(relatorio.numeroRelatorio))
          ? String(relatorio.numeroRelatorio)
          : undefined,
    });

    await this.fileService.update(files, {
      ...updateInput,
      id,
      produtorId: updateInput.produtorId || relatorio.produtorId,
      contratoId: updateInput.contratoId || relatorio.contratoId,
    });
  }

  async remove(id: string) {
    const [relatorio] = await this.findMany({ ids: [id] }); // get updated readOnly and atendimentoId props
    if (!relatorio) throw new NotFoundException('Relatório não encontrado');
    if (relatorio.readOnly) {
      throw new UnauthorizedException(
        'Não é possível remover relatório, pois já foi validado pela gerência.',
      );
    }

    const atendimentoId = relatorio.atendimentoId?.toString();
    const relatorioDto = new Relatorio(relatorio).toDto();

    try {
      if (atendimentoId) {
        await this.atendimentoService.logicRemove(atendimentoId);
      }
      await this.removeFiles(relatorioDto);
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e));
      this.logger.error(
        `Erro ao remover relatório ${id}, atendimento ${relatorio.atendimentoId}:\n
         ${error.message}`,
        { stack: error.stack, error },
      );
    }

    await this.prismaService.relatorio.delete({ where: { id } });
    return `Relatorio ${id} removed. \n Produtor ${relatorio.produtorId}, técnico ${relatorio.tecnicoId} atendimento ${relatorio.atendimentoId}`;
  }

  private async syncAtendimentoTemasAndNumero({
    atendimentoId,
    temasAtendimento,
    numeroVisita,
    oldRelatorioNumber,
  }: UpdateTemasAndVisitaAtendimentoDTO) {
    if (!atendimentoId) return;

    const shouldUpdateNumero =
      !!numeroVisita && numeroVisita !== oldRelatorioNumber;

    const shouldUpdateTemas = !!temasAtendimento && temasAtendimento.length > 0;

    if (!shouldUpdateTemas && !shouldUpdateNumero) return;

    await this.atendimentoService.updateTemasAndVisita({
      atendimentoId,
      temasAtendimento: shouldUpdateTemas ? temasAtendimento : undefined,
      numeroVisita: shouldUpdateNumero ? numeroVisita : undefined,
    });
  }

  private async setRelatoriosReadOnlyStatus(relatorios: RelatorioDto[]) {
    const readOnlyIds = await this.restAPI.getReadOnlyRelatorios(
      relatorios.map((r) => r.id),
    );

    const response = relatorios.map((r) => ({
      ...r,
      readOnly: readOnlyIds.includes(r.id),
    }));
    return response;
  }

  async checkForDuplicateRelatorios(relatorio: RelatorioModel) {
    const relatorioDto = new Relatorio(relatorio).toDto();
    const { produtorId, tecnicoId, numeroRelatorio, contratoId, createdAt } =
      relatorioDto;

    if (!produtorId || !numeroRelatorio || !contratoId || !tecnicoId) return;
    const startOfDay = new Date(createdAt);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(createdAt);
    endOfDay.setHours(23, 59, 59, 999);

    const duplicateCandidate = await this.prismaService.relatorio.findFirst({
      where: {
        produtorId,
        tecnicoId,
        numeroRelatorio,
        contratoId,
        createdAt: { gte: startOfDay, lte: endOfDay },
      },
    });

    if (duplicateCandidate) {
      await this.atendimentoService.logicRemove(relatorio.atendimentoId); //Remove antendimento previamente cadastrado
      throw new ConflictException('Relatório já cadastrado.');
    }
  }

  // `useCache` is set only by the web hot path (findAll expand: true); mobile and
  // the export ZIP path fetch the mapping live (see CachedReplacedAtendimentosReader).
  private async updateAtendimentoIds(
    relatorios: RelatorioModel[],
    useCache = false,
  ) {
    const replacedAtendimentos = useCache
      ? await this.cachedReplacedAtendimentosReader.get()
      : ((await this.atendimentoService.getReplacedAtendimentos()) as AtendimentoUpdate[]);
    if (!replacedAtendimentos?.length) {
      return;
    }

    const updatedRelatorios = RelatorioDomainService.updateAtendimentoIds(
      relatorios,
      replacedAtendimentos,
    );
    return updatedRelatorios;
  }

  private async fixAtendimentoDate(relatorio: RelatorioModel) {
    const { atendimentoId, createdAt } = relatorio;
    if (!atendimentoId || !createdAt) return;

    try {
      await this.atendimentoService.fixDatesIfNeeded({
        atendimentoId: String(atendimentoId),
        createdAt,
      });
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e));
      this.logger.error(
        `Falha ao corrigir data do atendimento ${atendimentoId}: ${error.message}`,
        error.stack,
      );
    }
  }

  private async removeFiles(relatorio: RelatorioDto) {
    const { pictureURI, assinaturaURI } = relatorio;
    const fileIds = [pictureURI, assinaturaURI].filter((f) => !!f);
    if (fileIds.length > 0) {
      await this.fileService.remove(fileIds);
    }
  }

  private handlePersistenceError(error: any) {
    if (error.code === 'P2002' && error.meta?.target?.includes('id')) {
      throw new ConflictException('Relatório com este ID já existe.');
    }
    throw error;
  }
}

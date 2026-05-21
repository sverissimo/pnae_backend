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
import { ProdutorService } from '../produtor/produtor.service';
import { RelatorioDataMapper } from './data-mapper/relatorio.data-mapper';
import { ProdutorModel } from 'src/@domain/produtor/produtor-model';
import { RelatorioPresentationModel } from './dto/relatorio.presentation-model';
import {
  buildDashboardData,
  DashboardData,
  DashboardRole,
} from 'src/@domain/relatorio/relatorio-dashboard-stats';
import { PerfilService } from '../perfil/perfil.service';

type queryObject = { ids?: string[]; produtorIds?: string[] };

@Injectable()
export class RelatorioService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly atendimentoService: AtendimentoService,
    private readonly produtorService: ProdutorService,
    private readonly fileService: FileService,
    private readonly restAPI: RestAPI,
    private readonly logger: WinstonLoggerService,
    private readonly perfilService: PerfilService,
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
    // .filter((r) => !!r.assunto);

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
    const role = this.resolveDashboardRole(user);

    const [fullRelatorios, regionais] = await Promise.all([
      this.findAll({ contratoId: 2 }, { expand: true }) as Promise<
        RelatorioPresentationModel[]
      >,
      this.perfilService.getRegionaisEmater(),
    ]);

    // Gauges + 30-day line chart use the same per-user scope as /relatorios/all.
    // Tops + by-regional charts always use the full set so non-admins still see
    // the global picture.
    const scoped = this.scopeRelatoriosForUser(fullRelatorios, user);
    const regionalLabel = this.resolveRegionalLabel(scoped);

    return buildDashboardData({
      fullRelatorios: fullRelatorios ?? [],
      scopedRelatorios: scoped,
      regionais: regionais ?? [],
      role,
      regionalLabel,
      topTecnicosLimit: 20,
      topSREsLimit: 10,
    });
  }

  private resolveDashboardRole(user?: Usuario): DashboardRole {
    if (!user) return 'other';
    if (user.isCoordenadorRegional()) return 'coordenadorRegional';
    if (user.isAdmin() || user.isDeveloper()) return 'admin';
    if (user.isStaff()) return 'staff';
    return 'other';
  }

  /**
   * Dashboard-only scoping. Differs from `getAuthorizedRelatorios` on purpose:
   * gauges and the 30-day line chart should reflect the user's *regional*, not
   * just their own relatorios — otherwise an extensionista sees only the
   * relatorios they personally created, which defeats the dashboard's point.
   * Both coordenadorRegional and staff get filtered by `r.id_reg_empresa ===
   * user.id_reg_empresa`.
   */
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
      this.canUserSeeRelatorio(r, user),
    );
    return scopedResult;
  }

  /**
   * Post-hydration authorization predicate for /relatorios/all.
   * - admin / developer       → see everything
   * - coordenadorRegional     → their regional PLUS their own work
   *                             (`id_reg_empresa` OR `tecnicoId`)
   * - staff (extensionista)   → only their own relatorios (`tecnicoId`)
   */
  private canUserSeeRelatorio(
    r: RelatorioPresentationModel,
    user: Usuario,
  ): boolean {
    if (user.isAdmin() || user.isDeveloper()) return true;
    const isOwn = String(r.tecnicoId) === String(user.id_usuario);
    if (user.isCoordenadorRegional()) {
      const inRegional =
        !!user.id_reg_empresa && r.id_reg_empresa === user.id_reg_empresa;
      return inRegional || isOwn;
    }
    if (user.isStaff()) return isOwn;
    return false;
  }

  async findAll(
    filter: Prisma.RelatorioWhereInput = {},
    options: { expand?: boolean } = {},
  ) {
    const relatorios = await this.prismaService.relatorio.findMany({
      where: filter,
      orderBy: { createdAt: 'desc' },
    });

    if (!relatorios || relatorios.length === 0) return [];

    const relatorioModels = relatorios.map(Relatorio.toModel);
    const updatedRelatorios = await this.updateAtendimentoIds(relatorioModels);
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

    const [produtores, atendimentos] = await Promise.all([
      this.produtorService.findManyById(produtorIds) as Promise<
        ProdutorModel[]
      >,
      this.atendimentoService.findMany(atendimentoIds),
    ]);

    return RelatorioDataMapper.manyToPresentationModel({
      relatorios,
      produtores,
      atendimentos: atendimentos,
    });
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

    const data = Relatorio.updateFieldsToDTO(updateData); // atendimentoId: newAtendimentoId, // Wont change anymore cause no 134
    await this.prismaService.relatorio.update({ where: { id }, data });

    await this.syncAtendimentoTemasAndNumero({
      atendimentoId: relatorio.atendimentoId?.toString(), // UPDATED AtendimentoId
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

  private async updateAtendimentoIds(relatorios: RelatorioModel[]) {
    const replacedAtendimentos =
      (await this.atendimentoService.getReplacedAtendimentos()) as AtendimentoUpdate[];
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

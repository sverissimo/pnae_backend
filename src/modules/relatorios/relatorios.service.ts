import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { FileService } from 'src/common/files/file.service';
import { RestAPI } from 'src/@rest-api-server/rest-api.service';
import { Relatorio } from 'src/@domain/relatorio/relatorio';
import { RelatorioDto } from './dto/relatorio.dto';
import { RelatorioModel } from 'src/@domain/relatorio/relatorio-model';
import { AtendimentoService } from '../atendimento/atendimento.service';
import { UpdateRelatorioDto } from './dto/update-relatorio.dto';
import { AtendimentoUpdate } from 'src/@domain/relatorio/types/atendimento-updates';
import { RelatorioDomainService } from 'src/@domain/relatorio/relatorio-domain-service';
import { WinstonLoggerService } from 'src/common/logging/winston-logger.service';
import { UpdateTemasAndVisitaAtendimentoDTO } from '../atendimento/dto/update-temas-and-visita-atendimento.dto';
import { FilesInputDto } from 'src/common/files/files-input.dto';
import { Usuario } from '../../@domain/usuario/usuario.entity';
import { ProdutorService } from '../produtor/produtor.service';
import { RelatorioDataMapper } from './data-mapper/relatorio.data-mapper';
import { ProdutorModel } from 'src/@domain/produtor/produtor-model';
import { RelatorioPresentationModel } from './dto/relatorio.presentation-model';

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

    const data = relatorios
      .map((r) => new Relatorio(r).toDto())
      .filter((r) => !!r.assunto);

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

    if (!relatorio) {
      throw new NotFoundException('Nenhum relatório encontrado');
    }
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

  async getAuthorizedRelatorios(user?: Usuario, expand = false) {
    const filter = this.createFilter(user);
    return this.findAll(filter, { expand });
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

    if (options.expand) return this.hydrateRelatorios(parsedRelatorios);
    return parsedRelatorios;
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

  private createFilter(user?: Usuario) {
    const baseFilter = { contratoId: 2 };
    if (!user) return { id: 'no-access' };
    if (user.isAdmin() || user.isDeveloper()) return baseFilter;
    if (user.isStaff()) {
      return { ...baseFilter, tecnicoId: BigInt(user.id_usuario) };
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
    } catch (error) {
      this.logger.error(
        `Erro ao remover relatório ${id}, atendimento ${relatorio.atendimentoId}:\n
         ${error.message}`,
        { stack: error.stack, error },
      );
    }

    await this.prismaService.relatorio.delete({ where: { id } });
    return `Relatorio ${id} removed. \n Produtor ${relatorio.produtorId}, técnico ${relatorio.tecnicoId} atendimento ${relatorio.atendimentoId}`;
  }

  async setRelatoriosReadOnlyStatus(relatorios: RelatorioDto[]) {
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
    } catch (error) {
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

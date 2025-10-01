import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

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

type queryObject = { ids?: string[]; produtorIds?: string[] };

@Injectable()
export class RelatorioService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly atendimentoService: AtendimentoService,
    private readonly fileService: FileService,
    private readonly restAPI: RestAPI,
    private readonly logger: WinstonLoggerService,
  ) {}

  async create(relatorioInput: RelatorioModel) {
    try {
      const relatorioDto = new Relatorio(relatorioInput).toDto();
      const createdRelatorio = await this.prismaService.relatorio.create({
        data: relatorioDto,
      });

      await this.fixAtendimentoDate(relatorioInput);

      return createdRelatorio;
    } catch (error) {
      await this.atendimentoService.logicRemove(relatorioInput.atendimentoId);
      if (error.code === 'P2002' && error.meta?.target?.includes('id')) {
        throw new Error('Relatório com este ID já existe');
      }
      throw error;
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
      const produtorIds = input.produtorIds.map((id) => BigInt(id));
      query = {
        OR: [{ id: { in: input.ids } }, { produtorId: { in: produtorIds } }],
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

  public async findByDataSeeRange({ from, to }: { from: string; to: string }) {
    const fromDate = new Date(from);
    const toDate = new Date(to);
    toDate.setHours(23, 59, 59, 999);

    const relatorios = await this.findAll(); // Already fixes atendimentoIds
    const atendimentoIds = relatorios.map((r) => r.atendimentoId);
    const atendimentos = await this.atendimentoService.findMany(atendimentoIds);

    const selectedAtendimentos = atendimentos.filter((at) => {
      const dataSEE = new Date(at.data_see);
      return dataSEE >= fromDate && dataSEE <= toDate;
    });

    const selectedAtendimentoIds = new Set(
      selectedAtendimentos.map((at) => at.id_at_atendimento),
    );

    const relatoriosWithinDateRange = relatorios.filter((r) =>
      selectedAtendimentoIds.has(r.atendimentoId),
    );

    return {
      selectedRelatorios: relatoriosWithinDateRange,
      selectedAtendimentos,
    };
  }

  async findAll() {
    const relatorios = await this.prismaService.relatorio.findMany({
      where: { contratoId: 2 },
      orderBy: { createdAt: 'desc' },
    });
    const relatorioModels = relatorios.map(Relatorio.toModel);
    const updatedRelatorios = await this.updateAtendimentoIds(relatorioModels);
    return updatedRelatorios || relatorioModels;
  }

  async update(updateInput: UpdateRelatorioDto) {
    console.log('🚀 - RelatorioService - update - update:', updateInput);

    const { id, atendimentoId, temas_atendimento, ...update } = updateInput;
    const [readOnly] = await this.restAPI.getReadOnlyRelatorios([id]);
    if (readOnly) {
      throw new UnauthorizedException(
        'Não é possível alterar relatório, pois já foi validado pela gerência.',
      );
    }
    const { numeroRelatorio: oldRelatorioNumber } = await this.findOne(id);

    const data = Relatorio.updateFieldsToDTO({
      ...update,
      // atendimentoId: newAtendimentoId, // Wont change anymore cause no 134
    });

    await this.prismaService.relatorio.update({
      where: { id },
      data,
    });

    // ************ ITEM 134 (Rel é sub de outro) FOI REMOVIDO DO BANCO. ************
    // const newAtendimentoId = await this.atendimentoService.updateIfNecessary(atendimentoId, String(numeroRelatorio));
    // *****************************************************************************
    //INSTEAD:

    await this.atendimentoService.updateTemasAndVisita({
      atendimentoId,
      temasAtendimento: temas_atendimento,
      numeroVisita: update.numeroRelatorio
        ? String(update.numeroRelatorio)
        : undefined,
      oldRelatorioNumber: oldRelatorioNumber,
    });

    // return newAtendimentoId;
  }

  async remove(id: string) {
    const relatorio = await this.findOne(id);
    if (relatorio.readOnly) {
      throw new UnauthorizedException(
        'Não é possível remover relatório, pois já foi validado pela gerência.',
      );
    }
    const relatorioModel = Relatorio.toModel(relatorio);
    const relatorioWithUpdatedAtendimentoId = this.updateAtendimentoIds([
      relatorioModel,
    ])?.[0];

    const atendimentoId = relatorioWithUpdatedAtendimentoId
      ? relatorioWithUpdatedAtendimentoId.atendimentoId?.toString()
      : relatorio?.atendimentoId?.toString();

    try {
      if (atendimentoId) {
        await this.atendimentoService.logicRemove(atendimentoId);
      }
    } catch (error) {
      this.logger.error(
        `🚀 RelatorioService.ts logicRemove error - atendimentoId: ${atendimentoId} / relatorioId: ${relatorio.id}` +
          error.message,
        { error },
      );
    }

    try {
      await this.removeFiles(relatorio);
    } catch (error) {
      this.logger.error(
        `🚀 RelatorioService.ts removeFiles error - relatorioId: ${relatorio.id}` +
          error.message,
        { error },
      );
    }

    await this.prismaService.relatorio.delete({ where: { id } });
    return `Relatorio ${id} removed.`;
  }

  async setRelatoriosReadOnlyStatus(relatorios: RelatorioDto[]) {
    const readOnlyIds = await this.restAPI.getReadOnlyRelatorios(
      relatorios.map((r) => r.id),
    );

    console.log('🚀 RelatorioService readOnlyIds:', readOnlyIds.slice(0, 50));

    const response = relatorios.map((r) => ({
      ...r,
      readOnly: readOnlyIds.includes(r.id),
    }));
    return response;
  }

  async checkForDuplicateRelatorios(relatorio: RelatorioModel) {
    const relatorioDto = new Relatorio(relatorio).toDto();
    const { produtorId, tecnicoId, numeroRelatorio, contratoId } = relatorioDto;

    if (!produtorId || !numeroRelatorio || !contratoId || !tecnicoId) return;

    const duplicateCandidate = await this.prismaService.relatorio.findFirst({
      where: {
        produtorId,
        tecnicoId,
        numeroRelatorio,
        contratoId,
      },
    });

    console.log('RelatorioService checkForDuplicate :', duplicateCandidate);

    if (duplicateCandidate) {
      //Remove antendimento previamente cadastrado
      await this.atendimentoService.logicRemove(relatorio.atendimentoId);
      throw new Error(`Relatório já cadastrado.`);
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
    try {
      const { atendimentoId, createdAt } = relatorio;
      await this.atendimentoService.fixDatesIfNeeded({
        atendimentoId: String(atendimentoId),
        createdAt,
      });
    } catch (error) {
      console.log('🚀 RelatorioService fixAtendimentoDate:', error);
    }
  }

  private async removeFiles(relatorio: RelatorioDto) {
    const { pictureURI, assinaturaURI } = relatorio;
    const fileIds = [pictureURI, assinaturaURI].filter((f) => !!f);
    if (fileIds.length > 0) {
      await this.fileService.remove(fileIds, relatorio);
    }
  }
}

import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import pLimit from 'p-limit';
import { PrismaService } from 'src/prisma/prisma.service';
import { FileService } from 'src/common/files/file.service';
import { UsuarioGraphQLAPI } from 'src/@graphQL-server/usuario-api.service';
import { ProdutorGraphQLAPI } from 'src/@graphQL-server/produtor-api.service';
import { formatCPF, unformatCPF } from 'src/utils/formatCPF';
import { Perfil } from 'src/@domain/perfil/perfil.entity';
import { PerfilModel } from 'src/@domain/perfil/perfil.model';
import { RestAPI } from 'src/@rest-api-server/rest-api.service';
import { Relatorio } from 'src/@domain/relatorio/relatorio';
import { RelatorioDto } from './dto/relatorio.dto';
import { RelatorioModel } from 'src/@domain/relatorio/relatorio-model';
import { Usuario } from '../usuario/entity/usuario-model';
import { AtendimentoService } from '../atendimento/atendimento.service';
import { PdfGenerator } from 'src/@pdf-gen/pdf-gen';
import { ZipCreator } from 'src/@zip-gen/ZipCreator';
import { ProdutorService } from '../produtor/produtor.service';
import { formatReverseDate } from 'src/utils';
import { UpdateRelatorioDto } from './dto/update-relatorio.dto';
import { AtendimentoUpdate } from 'src/@domain/relatorio/types/atendimento-updates';
import { RelatorioDomainService } from 'src/@domain/relatorio/relatorio-domain-service';
import { ProdutorFindManyOutputDTO } from '../produtor/types/produtores.output-dto';
import { WinstonLoggerService } from 'src/common/logging/winston-logger.service';

type queryObject = { ids?: string[]; produtorIds?: string[] };

@Injectable()
export class RelatorioService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly usuarioApi: UsuarioGraphQLAPI,
    private readonly produtorApi: ProdutorGraphQLAPI,
    private readonly produtorService: ProdutorService,
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

      await this.checkAtendimentoDate(relatorioInput);

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

  async findManyById(ids: string[]) {
    const relatorios = await this.prismaService.relatorio.findMany({
      where: { id: { in: ids } },
    });
    const relatoriosWithPermissions = (
      await this.updateRelatoriosPermissions(relatorios)
    ).map(Relatorio.toModel);
    return relatoriosWithPermissions;
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

    const relatoriosWithPermissions = (
      await this.updateRelatoriosPermissions(relatorios)
    ).map(Relatorio.toModel);
    return relatoriosWithPermissions;
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

  async update(updateInput: UpdateRelatorioDto) {
    console.log('🚀 - RelatorioService - update - update:', updateInput);

    const { id, atendimentoId, temas_atendimento, ...update } = updateInput;
    const { numeroRelatorio: oldRelatorioNumber, readOnly } =
      await this.findOne(id);
    if (readOnly) {
      throw new UnauthorizedException(
        'Não é possível alterar relatório, pois já foi validado pela gerência.',
      );
    }

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

    const atendimentoId = relatorio?.atendimentoId?.toString();
    if (atendimentoId) {
      await this.atendimentoService.logicRemove(atendimentoId);
    }

    await this.removeFiles(relatorio);
    await this.prismaService.relatorio.delete({ where: { id } });
    return `Relatorio ${id} removed.`;
  }

  async getReadOnly(relatorios: RelatorioDto[]) {
    try {
      const ids = relatorios.map((r) => r.id);
      const readOnly = await this.restAPI.getReadOnlyRelatorios(ids);
      return readOnly;
    } catch (error) {
      console.log(
        '🚀 ~ file: relatorios.service.ts:100 ~ RelatorioService ~ getReadOnly ~ error:',
        error,
      );
    }
  }

  async updateRelatoriosPermissions(relatorios: RelatorioDto[]) {
    const readOnlyIds = await this.getReadOnly(relatorios);
    const editableIds = relatorios
      .filter((r) => !readOnlyIds.includes(r.id))
      .map((r) => r.id);
    const editableUpdates = { ids: editableIds, update: { readOnly: false } };
    const readOnlyUpdates = { ids: readOnlyIds, update: { readOnly: true } };

    await Promise.all([
      this.updateMany(editableUpdates),
      this.updateMany(readOnlyUpdates),
    ]);
    const response = relatorios.map((r) => ({
      ...r,
      readOnly: readOnlyIds.includes(r.id),
    }));
    return response;
  }

  async createPDFInput(relatorioId: string, relatorioInput?: RelatorioModel) {
    const relatorio = relatorioInput || (await this.findOne(relatorioId));
    if (!relatorio) {
      throw new NotFoundException('Relatório não encontrado');
    }

    try {
      const { outroExtensionista, contratoId: relatorioContratoId } = relatorio;

      const tecnicoId = relatorio.tecnicoId.toString();
      const tecnicoIds = outroExtensionista
        ? tecnicoId + ',' + outroExtensionista
        : tecnicoId;
      const { usuarios } = (await this.usuarioApi.getUsuarios({
        ids: tecnicoIds,
      })) as {
        usuarios: Usuario[];
      };
      const usuario = usuarios.find((u) => u.id_usuario == relatorio.tecnicoId);
      let outrosExtensionistas: Usuario[] | undefined;

      if (outroExtensionista) {
        outrosExtensionistas = usuarios
          .filter((u) => u.id_usuario != relatorio.tecnicoId)
          .map((e) => ({
            ...e,
            matricula_usuario: e.digito_matricula
              ? e.matricula_usuario + '-' + e.digito_matricula
              : e.matricula_usuario,
          }));
      }

      const produtor = await this.produtorApi.getProdutorById(
        relatorio.produtorId.toString(),
      );

      const { perfis, propriedades } = produtor;

      if (!propriedades || !propriedades.length) {
        throw new NotFoundException(
          `Nenhuma propriedade encontrada para o produtor ${produtor.nm_pessoa}`,
        );
      }
      if (!perfis || !perfis.length) {
        throw new NotFoundException(
          `Nenhum Perfil encontrado para o produtor ${produtor.nm_pessoa}`,
        );
      }

      const perfil = perfis.find(
        (p: PerfilModel) =>
          p.id_contrato === (relatorioContratoId || 1) &&
          p.tipo_perfil === 'ENTRADA',
      ) as PerfilModel;

      const perfilDTO = new Perfil(perfil).toDTO();
      const { dados_producao_in_natura, dados_producao_agro_industria } =
        perfilDTO || {};

      const nome_propriedade = propriedades
        .map((p) => p.nome_propriedade)
        .join(', ');

      const perfilPDFModel = new Perfil().toPDFModel({
        ...perfil,
        nome_propriedade,
      });

      const { municipio } = propriedades[0];
      const matricula = usuario.digito_matricula
        ? usuario.matricula_usuario + '-' + usuario.digito_matricula
        : usuario.matricula_usuario;

      return {
        relatorio: {
          ...relatorio,
          produtor: {
            nomeProdutor: produtor.nm_pessoa,
            cpfProdutor: formatCPF(produtor.nr_cpf_cnpj),
            caf: produtor.caf || produtor.dap,
            id_und_empresa: produtor.id_und_empresa,
          },
          nomeTecnico: usuario.nome_usuario,
          matricula,
          municipio: municipio.nm_municipio,
          outrosExtensionistas,
        },
        nome_propriedade,
        dados_producao_in_natura,
        dados_producao_agro_industria,
        perfilPDFModel,
      };
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException(error.message);
    }
  }

  async createZipFile() {
    const unsentRelatorios = await this.getUnsentRelatorios();
    if (!unsentRelatorios.length) {
      return 'Não há nenhum relatório para ser enviado para a SEE.';
    }

    const relatoriosPorRegional = await this.getRelatoriosPorRegional(
      unsentRelatorios,
    );

    const allTempParts = await this.createZipFilesForAllRegions(
      relatoriosPorRegional,
    );

    const finalZipPath = await ZipCreator.generateFinalZip(allTempParts);

    // const idsToRegisterDataSEI = unsentRelatorios.map((r) => r.atendimentoId);
    // await this.atendimentoService.saveIdsToFile(idsToRegisterDataSEI);

    return `Arquivo gerado: ${finalZipPath}`;
  }

  async downloadRelatorioZip() {
    try {
      await this.atendimentoService.registerDataSEI();
    } catch (error) {
      console.log(
        '🚀 - RelatorioService - downloadRelatorioZip - error:',
        error,
      );
    }
    const zipPath = process.env.ZIP_FILES_PATH;
    const zipStream = fs.createReadStream(`${zipPath}/final.zip`);
    return zipStream;
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

  private async checkAtendimentoDate(relatorio: RelatorioModel) {
    try {
      const { atendimentoId, createdAt } = relatorio;
      await this.atendimentoService.checkDates({
        atendimentoId: String(atendimentoId),
        createdAt,
      });
    } catch (error) {
      console.log('🚀 RelatorioService checkAtendimentoDate:', error);
    }
  }

  private async getRelatoriosPorRegional(relatorios: RelatorioModel[]) {
    const uniqueProdutoresIds = [
      ...new Set(relatorios.map((r) => r.produtorId)),
    ];

    const produtores = (await this.produtorService.findManyById(
      uniqueProdutoresIds,
    )) as ProdutorFindManyOutputDTO[];

    return RelatorioDomainService.groupByRegionAndCity(relatorios, produtores);
  }

  private async createZipFilesForAllRegions(
    grouped: Array<Record<string, Array<Record<string, RelatorioModel[]>>>>,
  ): Promise<string[]> {
    const regionLimit = pLimit(3);
    const pdfLimit = pLimit(6); // inside each region, run 6 PDFs at a time

    const regionTasks = grouped.map((regionEntry) =>
      regionLimit(async () => {
        const region = Object.keys(regionEntry)[0];
        const municipiosArray = regionEntry[region];
        const municipiosList = municipiosArray.map((m) => {
          const municipio = Object.keys(m)[0];
          return { municipio, relatorios: m[municipio] as RelatorioModel[] };
        });

        try {
          const creator = new ZipCreator(region, {
            maxSizeBytes: 40 * 1024 * 1024,
          });

          return creator.generateRegionZipParts(
            municipiosList,
            (relatorio) =>
              pdfLimit(() => this.createPDFStream(relatorio.id, relatorio)), // ✅ concurrency per PDF
          );
        } catch (error) {
          this.logger.error(
            `[RelatorioService] Error creating zip for region ${region}: ${error.message}`,
            { error },
          );
        }
      }),
    );

    const regionPartsArrays = await Promise.all(regionTasks);
    return regionPartsArrays.flat();
  }

  private async getUnsentRelatorios(): Promise<RelatorioModel[]> {
    // const atendimentosSemDataSEI: Partial<Atendimento>[] =
    //   await this.atendimentoService.getAtendimentosWithoutDataSEI();
    // if (!atendimentosSemDataSEI.length) return [] as any;
    // console.log('🚀RelatorioService idsSemSEI:', atendimentosSemDataSEI.length);

    const relatorios = await this.findAll();
    return relatorios ? relatorios.slice(0, 100) : [];
  }

  async createPDFStream(relatorioId: string, relatorioInput?: RelatorioModel) {
    const {
      relatorio,
      perfilPDFModel,
      nome_propriedade,
      dados_producao_agro_industria,
      dados_producao_in_natura,
    } = await this.createPDFInput(relatorioId, relatorioInput);

    const pdfStream = await PdfGenerator.generatePdf({
      relatorio,
      perfilPDFModel,
      nome_propriedade,
      dados_producao_agro_industria,
      dados_producao_in_natura,
    });

    this.attachCleanup(pdfStream);

    const { municipio, atendimentoId, createdAt } = relatorio;
    const { nomeProdutor, cpfProdutor } = relatorio.produtor;
    const unformattedCPF = unformatCPF(cpfProdutor);
    const date = formatReverseDate(new Date(createdAt));

    const sanitizeSegment = (s: string) =>
      (s ?? '')
        .normalize('NFKC')
        .replace(/[\/\\:*?"<>|]/g, '')
        .replace(/\s+/g, ' ')
        .trim();

    const filename =
      [
        '2.3',
        sanitizeSegment(municipio),
        sanitizeSegment(nomeProdutor),
        date,
        atendimentoId,
        unformattedCPF,
        'final',
      ].join('_') + '.pdf';

    // ✅ write to tmp file instead of buffering
    const tmpPath = path.join(os.tmpdir(), `${relatorioId}.pdf`);
    const writeStream = fs.createWriteStream(tmpPath);
    await new Promise<void>((resolve, reject) => {
      pdfStream.pipe(writeStream);
      pdfStream.on('error', reject);
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });

    return { filename, filePath: tmpPath };
  }

  private attachCleanup(pdfStream: NodeJS.ReadableStream) {
    const child = (pdfStream as any).child;
    pdfStream.on('close', () => {
      if (child && !child.killed) {
        child.kill();
      }
    });
    return pdfStream;
  }

  private async removeFiles(relatorio: RelatorioDto) {
    const { pictureURI, assinaturaURI } = relatorio;
    const fileIds = [pictureURI, assinaturaURI].filter((f) => !!f);
    if (fileIds.length > 0) {
      await this.fileService.remove(fileIds, relatorio);
    }
  }

  private async updateMany({
    ids,
    update,
  }: {
    ids: string[];
    update: Partial<RelatorioDto>;
  }) {
    const updated = await this.prismaService.relatorio.updateMany({
      where: { id: { in: ids } },
      data: update,
    });
    return updated;
  }
}

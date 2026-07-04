import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import * as fsp from 'fs/promises';
import { randomUUID } from 'crypto';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';

import { Readable } from 'stream';
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import pLimit from 'p-limit';
import { RelatorioModel } from 'src/@domain/relatorio/relatorio-model';
import { Perfil, PerfilModel } from 'src/@domain/perfil';
import { ProdutorGraphQLAPI } from 'src/@graphQL-server/produtor-api.service';
import { UsuarioGraphQLAPI } from 'src/@graphQL-server/usuario-api.service';
import { PdfGenerator } from 'src/@pdf-gen/pdf-gen';
import { assembleDemeterPdf } from 'src/@pdf-gen/demeter-pdf-assembler';
import { DemeterPdfInput } from 'src/@pdf-gen/types/create-pdf-input';
import { ZipCreator } from 'src/@zip-gen/ZipCreator';
import { RelatorioService } from './relatorios.service';
import { AtendimentoService } from '../atendimento/atendimento.service';
import { ProdutorService } from '../produtor/produtor.service';
import { WinstonLoggerService } from 'src/logging/winston-logger.service';
import { formatCPF, unformatCPF, formatReverseDate } from 'src/utils';
import {
  JobStatusDTO,
  RegionalZipGroup,
  ZIP_QUEUE_NAME,
  ZipFileMetadata,
  ZipRelatorioItem,
} from './dto/zip-job.dtos';
import { UsuarioModel } from 'src/@domain/usuario/usuario-model';
import { groupZipItemsByRegional } from './utils/group-zip-items';
import { cleanupOldZips } from './utils/cleanup-old-zips';

const CURRENT_PNAE_CONTRATO_ID = 2;

// Same placeholder names ZipCreator/groupByRegionAndCity already use for unresolved locations.
const REGIONAL_NAO_ENCONTRADA = 'regional_nao_encontrada';
const MUNICIPIO_NAO_ENCONTRADO = 'mun_nao_encontrado';

// PNAE-supported stored MIMEs for the combined manual PDF; anything else (the ~3 stray
// `application/msword` rows) is bad stored data and gets a clear unsupported-file error.
const DEMETER_PDF_SUPPORTED_TIPOS = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/gif',
]);

@Injectable()
export class RelatorioExportService {
  private readonly historyDir = path.resolve(
    process.env.ZIP_FILES_PATH || 'zip-history',
  );
  private readonly redis: IORedis;
  private readonly zipQueue: Queue;

  constructor(
    private readonly usuarioApi: UsuarioGraphQLAPI,
    private readonly produtorApi: ProdutorGraphQLAPI,
    private readonly produtorService: ProdutorService,
    private readonly atendimentoService: AtendimentoService,
    private readonly relatorioService: RelatorioService,
    private readonly logger: WinstonLoggerService,
  ) {
    this.redis = new IORedis(process.env.REDIS_URL);
    this.zipQueue = new Queue(ZIP_QUEUE_NAME, {
      connection: this.redis,
    });
  }

  public async createPDFInput(
    relatorioId: string,
    relatorioInput?: RelatorioModel,
  ) {
    const relatorio =
      relatorioInput || (await this.relatorioService.findOne(relatorioId));
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
        usuarios: UsuarioModel[];
      };
      const usuario = usuarios.find((u) => u.id_usuario == relatorio.tecnicoId);
      let outrosExtensionistas: UsuarioModel[] | undefined;

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

  public async createPDFStream(
    relatorioId: string,
    relatorioInput?: RelatorioModel,
  ) {
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

    const filename =
      [
        '2.3',
        this.sanitizeSegment(municipio),
        this.sanitizeSegment(nomeProdutor),
        date,
        atendimentoId,
        unformattedCPF,
        'final',
      ].join('_') + '.pdf';

    const tmpPath = this.createTempPdfPath(`pnae-${relatorioId}`);
    const writeStream = fs.createWriteStream(tmpPath);
    await new Promise<void>((resolve, reject) => {
      pdfStream.pipe(writeStream);
      pdfStream.on('error', reject);
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });

    return { filename, filePath: tmpPath };
  }

  // Combined manual-relatório PDF (docs/plans/atendimentos-manuais-file-download-options.md,
  // Phase 2): perfil cover, then every relatório PDF's pages, then every proof photo as an
  // image page — file groups ordered lowest idArquivo first.
  public async createDemeterRelatorioPdf(
    atendimentoId: string,
  ): Promise<{ pdf: Buffer; nomeProdutor: string }> {
    const arquivos =
      await this.atendimentoService.getArquivosAtendimento(atendimentoId);

    const naoSuportado = arquivos.find(
      (arquivo) => !DEMETER_PDF_SUPPORTED_TIPOS.has(arquivo.tipoArquivo),
    );
    if (naoSuportado) {
      throw new BadRequestException(
        `Arquivo em formato não suportado para o relatório manual: ${
          naoSuportado.tipoArquivo ?? 'desconhecido'
        }.`,
      );
    }

    const input = await this.createDemeterPdfInput(
      atendimentoId,
      arquivos.length > 0,
    );
    const coverStream = await PdfGenerator.generateDemeterPdf(input);
    const coverPdf = await this.streamToBuffer(coverStream);

    const pdf = await assembleDemeterPdf({
      coverPdf,
      relatorioPdfs: arquivos.filter(
        (arquivo) => arquivo.tipoArquivo === 'application/pdf',
      ),
      fotos: arquivos.filter(
        (arquivo) => arquivo.tipoArquivo !== 'application/pdf',
      ),
    });

    return { pdf, nomeProdutor: input.produtor.nomeProdutor };
  }

  private async createDemeterPdfInput(
    atendimentoId: string,
    possuiArquivos: boolean,
  ): Promise<DemeterPdfInput> {
    const atendimento = await this.atendimentoService.findOne(atendimentoId);
    if (!atendimento) {
      throw new NotFoundException('Atendimento não encontrado');
    }

    const atendimentoProdutor = atendimento.at_cli_atend_prop;
    const produtorId = atendimentoProdutor?.id_pessoa_demeter;
    if (!produtorId) {
      throw new NotFoundException(
        'Produtor não encontrado para este atendimento',
      );
    }

    const produtor = await this.produtorApi.getProdutorById(String(produtorId));
    if (!produtor) {
      throw new NotFoundException('Produtor não encontrado');
    }

    const propriedades = produtor.propriedades ?? [];
    const nome_propriedade = propriedades.length
      ? propriedades.map((p) => p.nome_propriedade).filter(Boolean).join(', ')
      : null;
    const perfil = this.findDemeterPerfil(produtor.perfis ?? []);
    const perfilDTO = perfil ? new Perfil(perfil).toDTO() : undefined;
    const perfilPDFModel = perfil
      ? new Perfil().toPDFModel({
          ...perfil,
          nome_propriedade: nome_propriedade ?? '',
        })
      : null;

    return {
      perfilPDFModel,
      produtor: {
        nomeProdutor: produtor.nm_pessoa,
        cpf: formatCPF(produtor.nr_cpf_cnpj) || '',
        caf: produtor.caf || produtor.dap || null,
        id_und_empresa: produtor.id_und_empresa ?? atendimento.id_und_empresa,
      },
      atendimento: {
        atendimentoId,
        data: atendimento.data_inicio_atendimento ?? null,
        id_und_empresa: atendimento.id_und_empresa ?? null,
        produtorId: String(produtorId),
        propriedadeId: atendimentoProdutor?.id_pl_propriedade ?? null,
        tecnicoId: atendimento.at_atendimento_usuario?.id_usuario ?? null,
      },
      nome_propriedade,
      dados_producao_in_natura: perfilDTO?.dados_producao_in_natura ?? null,
      dados_producao_agro_industria:
        perfilDTO?.dados_producao_agro_industria ?? null,
      possuiArquivos,
    };
  }

  public async createZipJob({
    userId,
    atendimentoIds,
  }: {
    userId: string;
    atendimentoIds: string[];
  }) {
    try {
      const job = await this.zipQueue.add(
        'build-zip',
        { userId, atendimentoIds },
        {
          removeOnFail: true,
          removeOnComplete: { count: 10 }, // don’t lose result immediately
          attempts: 1,
        },
      );

      const jobState = await job.getState();

      await Promise.all([
        this.redis.set('zip:last', job.id), // ------------ REMOVE ?????
        this.redis.set(
          `zip:${job.id}`,
          JSON.stringify({
            userId,
            status: jobState || 'processing',
            atendimentoCount: atendimentoIds.length,
            requestedAtendimentoIds: atendimentoIds,
          }),
          'EX',
          60 * 60 * 24,
        ),
      ]);

      return { jobId: job.id, status: jobState, ...job.data };
    } catch (error: any) {
      this.logger.error(
        `RelatorioExportService ~ createZipJob - ${
          error?.message ?? String(error)
        }\n${error?.stack ?? ''}`,
      );
      throw error;
    }
  }

  private findDemeterPerfil(perfis: PerfilModel[]): PerfilModel | undefined {
    return (
      perfis.find(
        (p) =>
          p.id_contrato === CURRENT_PNAE_CONTRATO_ID &&
          p.tipo_perfil === 'ENTRADA',
      ) ?? perfis.find((p) => p.tipo_perfil === 'ENTRADA')
    );
  }

  private async streamToBuffer(
    stream: NodeJS.ReadableStream,
  ): Promise<Buffer> {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  public async getZipJobStatus(jobId?: string): Promise<JobStatusDTO | null> {
    try {
      if (!jobId) {
        const last = await this.redis.get('zip:last');
        if (last) jobId = last;
        else return null;
      }
      if (!jobId) {
        return {
          jobId: '',
          status: 'failed',
          errorMessage: 'Job não encontrado.',
        };
      }

      const job = await this.zipQueue.getJob(jobId);

      if (job) {
        const state = await job.getState(); // 'completed' | 'failed' | 'active' | 'waiting' | 'delayed' | 'paused'
        const createdAt = new Date(job.timestamp).toISOString();

        if (state === 'completed') {
          const jobReturnedValue = (await job.returnvalue) || undefined;

          if (jobReturnedValue && typeof jobReturnedValue === 'string') {
            const noRelatorioFound = jobReturnedValue.startsWith('Não há nenh');
            if (noRelatorioFound) {
              return {
                jobId,
                status: 'empty',
                createdAt,
                errorMessage: jobReturnedValue,
              };
            }

            const filename = path.basename(jobReturnedValue);
            return {
              jobId,
              status: 'completed',
              createdAt,
              downloadUrl: `/relatorios/zip/download/${encodeURIComponent(
                filename,
              )}`,
            };
          }
        }

        if (state === 'active' || state === 'delayed' || state === 'waiting') {
          return { jobId, status: 'processing', createdAt };
        }

        if (state === 'failed') {
          return {
            jobId,
            status: 'failed',
            createdAt,
            errorMessage: job.failedReason || 'Falha ao gerar ZIP',
          };
        }
      }

      // If job metadata already aged out, fall back to generic not found
      return { jobId, status: 'failed', errorMessage: 'Job não encontrado.' };
    } catch (error: any) {
      this.logger.error(
        `RelatorioExportService ~ getZipJobStatus - ${
          error?.message ?? String(error)
        }\n${error?.stack ?? ''}`,
      );
      return {
        jobId: jobId ?? '',
        status: 'failed',
        errorMessage: 'Erro ao consultar status do job.',
      };
    }
  }

  public async getZipHistory(): Promise<ZipFileMetadata[]> {
    try {
      const dir = this.historyDir; // e.g., /var/app/zip-history
      const entries = await fsp.readdir(dir, { withFileTypes: true });
      const files = entries
        .filter(
          (e) =>
            e.isFile() &&
            e.name.startsWith('relatorios_') &&
            e.name.toLowerCase().endsWith('.zip'),
        )
        .map((e) => e.name);

      const withStats = await Promise.all(
        files.map(async (name) => {
          const full = path.join(dir, name);
          const stat = await fsp.stat(full);
          return { name, mtimeMs: stat.mtimeMs };
        }),
      );

      return withStats
        .sort((a, b) => b.mtimeMs - a.mtimeMs)
        .slice(0, 5)
        .map(({ name, mtimeMs }) => {
          const dateRangeMatch = name.match(
            /relatorios_(\d{4}-\d{2}-\d{2})_a_(\d{4}-\d{2}-\d{2})\.zip$/,
          );
          const atendimentoIdsMatch = name.match(
            /relatorios_atendimentos_\d{4}-\d{2}-\d{2}_\d{6}\.zip$/,
          );
          const mode = dateRangeMatch
            ? 'date-range'
            : atendimentoIdsMatch
              ? 'atendimento-ids'
              : 'atendimento-ids';

          return {
            filename: name,
            createdAt: new Date(mtimeMs).toISOString().split('T')[0],
            mode,
            ...(dateRangeMatch
              ? { fromDate: dateRangeMatch[1], toDate: dateRangeMatch[2] }
              : {}),
            downloadUrl: `relatorios/zip/download/${encodeURIComponent(name)}`,
          };
        });
    } catch (error: any) {
      this.logger.error(
        `RelatorioExportService ~ getZipHistory - ${
          error?.message ?? String(error)
        }\n${error?.stack ?? ''}`,
      );
      // Keep a safe default
      return [];
    }
  }

  public async createZipFile({ atendimentoIds }: { atendimentoIds: string[] }) {
    const { items, skippedIds } = await this.resolveZipItems(atendimentoIds);

    if (skippedIds.length) {
      this.logger.warn(
        `[RelatorioExportService] createZipFile - ids sem relatório (ignorados): ${skippedIds.join(
          ', ',
        )}`,
      );
    }

    if (!items.length) {
      return 'Não há nenhum relatório para ser anexado no SEI.';
    }

    const grouped = groupZipItemsByRegional(items);
    const tmpZipRootDir = await fsp.mkdtemp(
      path.join(os.tmpdir(), 'pnae-zips-'),
    );
    try {
      const filePaths = await this.createZipFilesForAllRegions(
        grouped,
        tmpZipRootDir,
      );

      if (!filePaths.length) {
        throw new Error(
          'Falha ao gerar os PDFs dos relatórios selecionados. Verifique os logs para identificar o atendimento com erro.',
        );
      }

      const finalZipPath = await ZipCreator.generateFinalZip({
        filePaths,
        finalZipName: `relatorios_atendimentos_${this.buildZipTimestamp()}.zip`,
      });

      await cleanupOldZips(this.historyDir, 5);

      return finalZipPath;
    } finally {
      await fsp.rm(tmpZipRootDir, { recursive: true, force: true });
    }
  }

  // Buckets the requested Demeter atendimento ids into PNAE-backed relatórios, Demeter-only
  // manual relatórios, and skipped ids (no relatório on either side), preserving paste order.
  public async resolveZipItems(atendimentoIds: string[]): Promise<{
    items: ZipRelatorioItem[];
    skippedIds: string[];
  }> {
    const relatorios = await this.relatorioService.findAll({
      contratoId: CURRENT_PNAE_CONTRATO_ID,
    });

    const relatorioByAtendimentoId = new Map<string, RelatorioModel>();
    for (const relatorio of relatorios) {
      if (relatorio.atendimentoId) {
        relatorioByAtendimentoId.set(String(relatorio.atendimentoId), relatorio);
      }
    }

    const pnaeIds = atendimentoIds.filter((id) =>
      relatorioByAtendimentoId.has(id),
    );
    const missingIds = atendimentoIds.filter(
      (id) => !relatorioByAtendimentoId.has(id),
    );

    const produtorIds = [
      ...new Set(
        pnaeIds.map((id) =>
          String(relatorioByAtendimentoId.get(id).produtorId),
        ),
      ),
    ];
    const produtores = produtorIds.length
      ? await this.produtorService.findManyById(produtorIds)
      : [];
    const produtorById = new Map(
      produtores.map((p) => [String(p.id_pessoa_demeter), p]),
    );

    const demeterLimit = pLimit(5);
    const demeterResults = await Promise.all(
      missingIds.map((id) =>
        demeterLimit(async () => ({
          id,
          demeter:
            await this.atendimentoService.getAtendimentoComRelatorioDemeter(id),
        })),
      ),
    );
    const demeterById = new Map(demeterResults.map((r) => [r.id, r.demeter]));

    const items: ZipRelatorioItem[] = [];
    const skippedIds: string[] = [];

    for (const atendimentoId of atendimentoIds) {
      const relatorio = relatorioByAtendimentoId.get(atendimentoId);
      if (relatorio) {
        const produtor = produtorById.get(String(relatorio.produtorId));
        items.push({
          source: 'pnae',
          atendimentoId,
          regional: produtor?.regional_sre || REGIONAL_NAO_ENCONTRADA,
          municipio: produtor?.municipio || MUNICIPIO_NAO_ENCONTRADO,
          relatorio,
        });
        continue;
      }

      const demeter = demeterById.get(atendimentoId);
      if (demeter) {
        items.push({
          source: 'demeter',
          atendimentoId,
          regional: demeter.nomeRegional || REGIONAL_NAO_ENCONTRADA,
          municipio: demeter.nomeMunicipio || MUNICIPIO_NAO_ENCONTRADO,
          demeter,
        });
        continue;
      }

      skippedIds.push(atendimentoId);
    }

    return { items, skippedIds };
  }

  private async createZipFilesForAllRegions(
    grouped: RegionalZipGroup[],
    tmpRootDir: string,
  ): Promise<string[]> {
    const regionLimit = pLimit(3);
    const pdfLimit = pLimit(6); // inside each region, run 6 PDFs at a time

    const regionTasks = grouped.map((regionEntry) =>
      regionLimit(async () => {
        try {
          const creator = new ZipCreator(regionEntry.regional, {
            maxSizeBytes: 40 * 1024 * 1024,
            tmpRootDir,
          });

          return creator.generateRegionZipParts(
            regionEntry.municipios,
            (item) => pdfLimit(() => this.createZipItemPdfFile(item)),
            (item) => `${item.source}:${item.atendimentoId}`,
          );
        } catch (error) {
          this.logger.error(
            `[RelatorioService] Error creating zip for region ${regionEntry.regional}: ${error.message}`,
            { error },
          );
          return [];
        }
      }),
    );

    const regionPartsArrays = await Promise.all(regionTasks);
    return regionPartsArrays.flat();
  }

  private async createZipItemPdfFile(
    item: ZipRelatorioItem,
  ): Promise<{ filename: string; filePath: string }> {
    if (item.source === 'pnae') {
      return this.createPDFStream(item.relatorio.id, item.relatorio);
    }

    return this.createDemeterPDFFile(item);
  }

  private async createDemeterPDFFile(
    item: Extract<ZipRelatorioItem, { source: 'demeter' }>,
  ): Promise<{ filename: string; filePath: string }> {
    const { pdf, nomeProdutor } = await this.createDemeterRelatorioPdf(
      item.atendimentoId,
    );
    const filename =
      [
        '2.3',
        this.sanitizeSegment(item.municipio),
        this.sanitizeSegment(nomeProdutor),
        item.atendimentoId,
        'manual',
      ].join('_') + '.pdf';
    const filePath = this.createTempPdfPath(`demeter-${item.atendimentoId}`);
    await fsp.writeFile(filePath, pdf);
    return { filename, filePath };
  }

  private createTempPdfPath(label: string): string {
    return path.join(
      os.tmpdir(),
      `pnae-pdf-${process.pid}-${Date.now()}-${randomUUID()}-${this.sanitizeSegment(
        label,
      )}.pdf`,
    );
  }

  private sanitizeSegment(s: string): string {
    return (s ?? '')
      .normalize('NFKC')
      .replace(/[\/\\:*?"<>|]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private buildZipTimestamp(date = new Date()): string {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const hh = String(date.getHours()).padStart(2, '0');
    const mi = String(date.getMinutes()).padStart(2, '0');
    const ss = String(date.getSeconds()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}_${hh}${mi}${ss}`;
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

  public async getDownloadStream(filename: string): Promise<Readable> {
    try {
      // Delegate to FS service (placeholder call; implementation lives elsewhere)
      // return this.fsService.getFileStream(filename);
      const fullPath = path.join(this.historyDir, filename); // sanitize inside FS service ideally
      // basic traversal guard
      if (
        filename.includes('..') ||
        filename.includes('/') ||
        filename.includes('\\')
      ) {
        throw new Error('Nome de arquivo inválido.');
      }
      // verify existence early to surface ENOENT predictably
      await fsp.access(fullPath, fs.constants.R_OK);
      return fs.createReadStream(fullPath);
    } catch (error: any) {
      this.logger.error(
        `RelatorioExportService ~ getDownloadStream - ${
          error?.message ?? String(error)
        }\n${error?.stack ?? ''}`,
      );
      throw error;
    }
  }
}

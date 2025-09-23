import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import * as fsp from 'fs/promises';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';

import { Readable } from 'stream';
import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import pLimit from 'p-limit';
import { RelatorioModel } from 'src/@domain/relatorio/relatorio-model';
import { RelatorioDomainService } from 'src/@domain/relatorio/relatorio-domain-service';
import { Perfil, PerfilModel } from 'src/@domain/perfil';
import { Usuario } from '../usuario/entity/usuario-model';
import { ProdutorGraphQLAPI } from 'src/@graphQL-server/produtor-api.service';
import { UsuarioGraphQLAPI } from 'src/@graphQL-server/usuario-api.service';
import { PdfGenerator } from 'src/@pdf-gen/pdf-gen';
import { ZipCreator } from 'src/@zip-gen/ZipCreator';
import { RelatorioService } from './relatorios.service';
import { AtendimentoService } from '../atendimento/atendimento.service';
import { ProdutorService } from '../produtor/produtor.service';
import { WinstonLoggerService } from 'src/common/logging/winston-logger.service';
import { formatCPF, unformatCPF, formatReverseDate } from 'src/utils';
import { ProdutorFindManyOutputDTO } from '../produtor/types/produtores.output-dto';
import { JobStatusDTO, ZipFileMetadata } from './dto/zip-job.dtos';
import { cleanupOldZips } from './utils/cleanup-old-zips';

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
    this.zipQueue = new Queue('zip-generation', {
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

  public async createZipFile({ from, to }: { from: string; to: string }) {
    const unsentRelatorios = await this.relatorioService.getUnsentRelatorios({
      from,
      to,
    });
    if (!unsentRelatorios.length) {
      return 'Não há nenhum relatório para ser enviado para a SEE.';
    }

    const relatoriosPorRegional = await this.getRelatoriosPorRegional(
      unsentRelatorios,
    );

    const filePaths = await this.createZipFilesForAllRegions(
      relatoriosPorRegional,
    );

    const finalZipPath = await ZipCreator.generateFinalZip({
      from,
      to,
      filePaths,
    });

    await cleanupOldZips(this.historyDir, 5);

    // const idsToRegisterDataSEI = unsentRelatorios.map((r) => r.atendimentoId);
    // await this.atendimentoService.saveIdsToFile(idsToRegisterDataSEI);

    return `Arquivo gerado: ${finalZipPath}`;
  }

  public async downloadRelatorioZip() {
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

  public async queueZipJob({
    userId,
    from,
    to,
  }: {
    userId: string;
    from: string;
    to: string;
  }): Promise<string> {
    try {
      const start = new Date(from);
      const end = new Date(to);
      if (Number.isNaN(+start) || Number.isNaN(+end) || start > end) {
        throw new Error('Intervalo de datas inválido.');
      }

      // enqueue single job (worker will generate and store final zip path)
      const job = await this.zipQueue.add(
        'build-zip',
        { userId, from, to },
        {
          removeOnFail: true,
          removeOnComplete: { count: 10 }, // don’t lose result immediately
          attempts: 1,
        },
      );

      // short-lived status record in Redis (TTL 24h)
      await this.redis.set(
        `zip:${job.id}`,
        JSON.stringify({ userId, from, to, status: 'pending' }),
        'EX',
        60 * 60 * 24,
      );

      return job.id;
    } catch (error: any) {
      this.logger.error(
        `RelatorioExportService ~ queueZipJob - ${
          error?.message ?? String(error)
        }\n${error?.stack ?? ''}`,
      );
      throw error;
    }
  }

  public async getZipJobStatus(jobId: string): Promise<JobStatusDTO> {
    try {
      const job = await this.zipQueue.getJob(jobId);

      if (job) {
        const state = await job.getState(); // waiting | active | completed | failed | delayed | paused
        console.log(
          '🚀 - RelatorioExportService - getZipJobStatus - state:',
          state,
        );

        if (state === 'completed') {
          const finalPath: string | undefined =
            (await job.returnvalue) || undefined;
          if (finalPath) {
            const filename = path.basename(finalPath);
            return {
              jobId,
              status: 'completed',
              downloadUrl: `/relatorios/zip/download/${encodeURIComponent(
                filename,
              )}`,
            };
          }
          // completed but no path? fall through to redis/meta
        }

        if (state === 'active' || state === 'delayed' || state === 'waiting') {
          return { jobId, status: 'processing' };
        }

        if (state === 'failed') {
          const failedReason = job.failedReason || 'Falha ao gerar ZIP';
          return { jobId, status: 'failed', errorMessage: failedReason };
        }
      }

      // Fallback to Redis (job metadata with TTL)
      const cached = await this.redis.get(`zip:${jobId}`);
      if (cached) {
        const meta = JSON.parse(cached);
        if (meta.status === 'completed' && meta.filePath) {
          const filename = path.basename(meta.filePath);
          return {
            jobId,
            status: 'completed',
            downloadUrl: `/relatorios/zip/download/${encodeURIComponent(
              filename,
            )}`,
          };
        }
        if (meta.status === 'failed') {
          return {
            jobId,
            status: 'failed',
            errorMessage: meta.errorMessage || 'Falha ao gerar ZIP',
          };
        }
        return { jobId, status: 'pending' };
      }

      // Not found anywhere
      return { jobId, status: 'failed', errorMessage: 'Job não encontrado.' };
    } catch (error: any) {
      this.logger.error(
        `RelatorioExportService ~ getZipJobStatus - ${
          error?.message ?? String(error)
        }\n${error?.stack ?? ''}`,
      );
      // keep KISS: surface a generic failed state
      return {
        jobId,
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
        .filter((e) => e.isFile() && e.name.toLowerCase().endsWith('.zip'))
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
          // Expect format: relatorios_YYYY-MM-DD_a_YYYY-MM-DD.zip
          const match = name.match(
            /relatorios_(\d{4}-\d{2}-\d{2})_a_(\d{4}-\d{2}-\d{2})\.zip$/,
          );

          const fromDate = match ? match[1] : '';
          const toDate = match ? match[2] : '';

          return {
            filename: name,
            createdAt: new Date(mtimeMs).toISOString().split('T')[0],
            fromDate,
            toDate,
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

  private attachCleanup(pdfStream: NodeJS.ReadableStream) {
    const child = (pdfStream as any).child;
    pdfStream.on('close', () => {
      if (child && !child.killed) {
        child.kill();
      }
    });
    return pdfStream;
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
}

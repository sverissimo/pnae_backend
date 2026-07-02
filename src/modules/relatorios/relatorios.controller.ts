import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseInterceptors,
  UploadedFiles,
  Query,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
  Res,
  Req,
  HttpException,
  ForbiddenException,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { Request, Response } from 'express';
import { RelatorioService } from './relatorios.service';
import { PdfGenerator } from 'src/@pdf-gen/pdf-gen';
import { FilesInputDto } from 'src/modules/files/files-input.dto';
import { RelatorioModel } from 'src/@domain/relatorio/relatorio-model';
import { WinstonLoggerService } from 'src/logging/winston-logger.service';
import { UpdateRelatorioDto } from './dto/update-relatorio.dto';
import { JobStatusDTO, ZipFileMetadata } from './dto/zip-job.dtos';
import { RelatorioExportService } from './relatorios.export.service';
import { toMobileRelatorio } from 'src/modules/@sync/utils/mobile-relatorio-fields';

@Controller('relatorios')
export class RelatorioController {
  constructor(
    private readonly relatorioService: RelatorioService,
    private readonly relatorioExportService: RelatorioExportService,
    private readonly logger: WinstonLoggerService,
  ) {}

  @Post()
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'foto', maxCount: 1 },
      { name: 'assinatura', maxCount: 1 },
    ]),
  )
  async create(
    @UploadedFiles() files: FilesInputDto,
    @Body() relatorio: RelatorioModel,
  ) {
    try {
      const savedRelatorio = await this.relatorioService.create(
        relatorio,
        files,
      );
      return savedRelatorio?.id;
    } catch (error: any) {
      this.errorHandler({
        error,
        relatorio,
        caller: 'RelatorioController.create',
      });
    }
  }

  @Get('/all')
  findAll(@Req() req: Request) {
    try {
      return this.relatorioService.getAuthorizedRelatorios(req.user, true);
    } catch (error) {
      console.log(error);
    }
  }

  @Get('/dashboard')
  async getDashboard(@Req() req: Request) {
    try {
      return await this.relatorioService.getDashboardData(req.user);
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e));
      this.logger.error(
        `RelatorioController.getDashboard - ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        error.message || 'Erro ao gerar dashboard',
      );
    }
  }

  @Get('/manual')
  async generateManualPdf(
    @Query('id') token: string | undefined,
    @Res() res: Response,
  ) {
    try {
      const atendimentoId = this.decodeManualPdfToken(token);
      const { pdf, nomeProdutor } =
        await this.relatorioExportService.createManualRelatorioPdf(
          atendimentoId,
        );
      const filename = this.sanitizeFilename(
        `relatorio_manual_${nomeProdutor}_${atendimentoId}.pdf`,
      );

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename=${filename}`);
      res.send(pdf);
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e));
      this.logger.error(
        'RelatorioController.generateManualPdf - ' + error.message,
        error.stack,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException(
        error.message || 'Erro ao gerar PDF manual',
      );
    }
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req: Request) {
    // Web (verified JWT) gets scoped; mobile (static CLIENT_TOKEN, undefined
    // req.user) stays unscoped to preserve the shipped contract — don't
    // generalize this shape. See AGENTS.md "Authentication flow (mobile vs web)".
    const relatorio = req.user
      ? await this.relatorioService.assertCanAccess(id, req.user)
      : await this.relatorioService.findOne(id);
    if (!relatorio) {
      throw new NotFoundException('Nenhum relatório encontrado');
    }
    return relatorio;
  }

  // Mobile-only route; strip web-only fields so the frozen app never receives a
  // property its fixed-schema SQLite table can't store. See docs/mobile-endpoint-contract.md.
  @Get()
  async findByProdutorId(@Query('produtorId') produtorId: string) {
    try {
      const relatorios = await this.relatorioService.findMany(produtorId);
      if (!relatorios) {
        throw new NotFoundException('Nenhum relatório encontrado');
      }

      return relatorios.map(toMobileRelatorio);
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e));
      this.logger.error(
        '🚀 ~ file: relatorios.controller.ts:85 ~ get ~ error:' + error.message,
        error.stack,
      );
      throw new InternalServerErrorException(error.message);
    }
  }

  @Patch(':id')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'foto', maxCount: 1 },
      { name: 'assinatura', maxCount: 1 },
    ]),
  )
  async update(
    @Param('id') id: string,
    @UploadedFiles() files: FilesInputDto,
    @Body() update: UpdateRelatorioDto,
    @Req() req: Request,
  ) {
    try {
      // Same mobile/web scoping split as `findOne` — only web gets scoped.
      if (req.user) {
        await this.relatorioService.assertCanAccess(id, req.user);
      }
      await this.relatorioService.update({ ...update, id, files });
      return;
    } catch (error) {
      this.errorHandler({
        error,
        relatorio: { id } as RelatorioModel,
        caller: 'RelatorioController.update',
      });
    }
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: Request) {
    try {
      if (!id) throw new BadRequestException('Id inválido');

      // Same mobile/web scoping split as findOne/update — only web gets scoped.
      if (req.user) {
        await this.relatorioService.assertCanAccess(id, req.user);
      }

      this.logger.error(`@@@ Called delete on relatorio ${id}`, '');

      const result = await this.relatorioService.remove(id);
      this.logger.error(`#### DELETED RELATORIO #### \n ${result}`, ''); // Not an error, use method to write to log file.

      return `Relatório ${id} removido com sucesso.`;
    } catch (error) {
      this.errorHandler({
        error,
        relatorio: { id } as RelatorioModel,
        caller: 'RelatorioController.remove',
      });
    }
  }

  private errorHandler(errorInputObj: {
    error: any;
    relatorio?: RelatorioModel;
    caller?: string;
  }) {
    const { error, relatorio, caller } = errorInputObj;
    console.log(`🚀 - RelatorioController ${caller} - error:`, error);
    this.logger.error(
      `Erro em ${caller}: relatório nº ${relatorio?.numeroRelatorio} - produtor ${relatorio?.produtorId}, tecnico ${relatorio?.tecnicoId}, atendimento ${relatorio?.atendimentoId} id ${relatorio?.id}:
      ${error.message}`,
      { stack: error.stack, error },
    );

    if (error instanceof HttpException) throw error;
    const status = Number(error?.status ?? error?.statusCode);
    if (!Number.isNaN(status)) {
      throw new HttpException(error?.message ?? String(error), status);
    }
    if (error?.message?.toLowerCase().includes('validation')) {
      throw new BadRequestException(error.message);
    }

    throw new InternalServerErrorException(
      error?.message ||
        String(error) ||
        'Erro interno ao processar a requisição.',
    );
  }

  // ------------ PDF and ZIP generation ------------

  @Get('/pdf/:id')
  async generatePdf(@Param('id') id: string, @Res() res: Response) {
    try {
      const {
        relatorio,
        perfilPDFModel,
        nome_propriedade,
        dados_producao_agro_industria,
        dados_producao_in_natura,
      } = await this.relatorioExportService.createPDFInput(id);

      const { numeroRelatorio, produtor } = relatorio;

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `inline; filename=relatorio_${produtor.nomeProdutor}_${numeroRelatorio}.pdf`,
      );

      const pdfStream = await PdfGenerator.generatePdf({
        relatorio,
        perfilPDFModel,
        nome_propriedade,
        dados_producao_agro_industria,
        dados_producao_in_natura,
      });

      pdfStream.pipe(res);
      // ...done!
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e));
      this.logger.error(
        '🚀 ~ file: relatorios.controller.ts:118 ~ genPDF ~ error:' +
          error.message,
        error.stack,
      );
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(
        error?.message || 'Erro ao gerar PDF',
      );
    }
  }

  private sanitizeFilename(filename: string): string {
    return filename
      .normalize('NFKC')
      .replace(/[\/\\:*?"<>|]/g, '')
      .replace(/\s+/g, '_')
      .trim();
  }

  private decodeManualPdfToken(token?: string): string {
    if (!token) {
      throw new BadRequestException('Token do relatório manual é obrigatório.');
    }
    if (!/^[A-Za-z0-9_-]+$/.test(token)) {
      throw new BadRequestException('Token do relatório manual inválido.');
    }

    const base64 = token.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(
      base64.length + ((4 - (base64.length % 4)) % 4),
      '=',
    );
    const decoded = Buffer.from(padded, 'base64').toString('utf8');

    if (!/^\d{6,}$/.test(decoded)) {
      throw new BadRequestException('Token do relatório manual inválido.');
    }

    return decoded.slice(5);
  }

  @Post('/zip/create-job')
  async createZipJob(
    @Body() body: { from: string; to: string; userId: string },
  ) {
    const { from, to, userId } = body;
    if (!from || !to || !userId) {
      throw new BadRequestException('from, to e userId são obrigatórios.');
    }

    this.ensureUserAllowed(userId); // If not allowed, an exception is thrown

    try {
      const job = await this.relatorioExportService.createZipJob({
        userId,
        from,
        to,
      });
      return job;
    } catch (error: any) {
      this.logger.error(
        `RelatorioController ~ generateZipJob - ${
          error?.message ?? String(error)
        }\n${error?.stack ?? ''}`,
      );
      throw new InternalServerErrorException(
        `Erro ao enfileirar geração do ZIP: ${
          error?.message ?? 'erro interno'
        }`,
      );
    }
  }

  @Get('/zip/status') //Get last job status if no jobId provided
  getLastZipJobStatus(): Promise<JobStatusDTO | null> {
    return this.relatorioExportService.getZipJobStatus();
  }

  @Get('/zip/status/:jobId')
  async getZipJobStatus(
    @Param('jobId') jobId: string | undefined,
  ): Promise<JobStatusDTO> {
    try {
      const job = await this.relatorioExportService.getZipJobStatus(jobId);
      if (!job) throw new NotFoundException('Job não encontrado.');
      return job;
    } catch (error: any) {
      this.logger.error(
        `RelatorioController ~ getZipJobStatus - ${
          error?.message ?? String(error)
        }\n${error?.stack ?? ''}`,
      );
      throw error;
    }
  }

  @Get('/zip/history')
  async listZipHistory(@Req() req: Request): Promise<ZipFileMetadata[]> {
    try {
      const baseUrl = `https://${req.headers.host}`;
      const url = await this.relatorioExportService.getZipHistory();
      return url.map((item) => ({
        ...item,
        downloadUrl: `${baseUrl}/${item.downloadUrl}`,
      }));
    } catch (error: any) {
      this.logger.error(
        `RelatorioController ~ listZipHistory - ${
          error?.message ?? String(error)
        }\n${error?.stack ?? ''}`,
      );
      throw new InternalServerErrorException(
        `Erro ao obter histórico: ${error?.message ?? 'erro interno'}`,
      );
    }
  }

  private ensureUserAllowed(userId: string): void {
    const allowedUserIds =
      process.env.ALLOWED_USER_IDS?.split(',').map((id) => id.trim()) ?? [];

    if (!allowedUserIds.includes(userId)) {
      throw new ForbiddenException('Usuário não autorizado.');
    }
  }

  @Get('/zip/download/:filename')
  async downloadZipFile(
    @Param('filename') filename: string,
    @Res() res: Response,
  ) {
    if (!filename) throw new BadRequestException('filename é obrigatório.');

    if (
      filename.includes('..') ||
      filename.includes('/') ||
      filename.includes('\\')
    ) {
      throw new BadRequestException('Nome de arquivo inválido.');
    }

    try {
      const stream =
        await this.relatorioExportService.getDownloadStream(filename);

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${encodeURIComponent(filename)}"`,
      );

      stream.pipe(res);
    } catch (error: any) {
      this.logger.error(
        `RelatorioController ~ downloadZipFile - ${
          error?.message ?? String(error)
        }\n${error?.stack ?? ''}`,
      );

      if (error.code === 'ENOENT') {
        throw new NotFoundException('Arquivo não encontrado.');
      }
      throw new InternalServerErrorException(
        `Erro ao preparar download: ${error?.message ?? 'erro interno'}`,
      );
    }
  }
}

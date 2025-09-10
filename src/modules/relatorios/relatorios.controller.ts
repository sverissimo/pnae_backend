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
  Header,
  Req,
  HttpException,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { FileService } from 'src/common/files/file.service';
import { RelatorioService } from './relatorios.service';
import { PdfGenerator } from 'src/@pdf-gen/pdf-gen';
import { FilesInputDto } from 'src/common/files/files-input.dto';
import { RelatorioModel } from 'src/@domain/relatorio/relatorio-model';
import { WinstonLoggerService } from 'src/common/logging/winston-logger.service';
import { getYesterdayStringDate } from 'src/utils';
import { UpdateRelatorioDto } from './dto/update-relatorio.dto';

@Controller('relatorios')
export class RelatorioController {
  constructor(
    private readonly relatorioService: RelatorioService,
    private readonly fileService: FileService,
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
      //throw error if duplicate and abort creation
      await this.relatorioService.checkForDuplicateRelatorios(relatorio);
      const savedRelatorio = await this.relatorioService.create(relatorio);

      if (files) {
        await this.fileService.save(files, relatorio);
      }

      return savedRelatorio?.id;
    } catch (error) {
      console.log('🚀 - RelatorioController 57 - error:', error);
      this.logger.error(
        'RelatorioController ~ create' + error?.message ||
          error?.stack ||
          String(error),
        error?.trace,
      );

      if (error instanceof HttpException) throw error;

      const status = Number(error?.status ?? error?.statusCode);
      if (!Number.isNaN(status)) {
        throw new HttpException(error?.message ?? String(error), status);
      }
      throw new BadRequestException(error?.message ?? String(error));
    }
  }

  @Get('/all')
  async findAll() {
    return await this.relatorioService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const relatorio = await this.relatorioService.findOne(id);
    if (!relatorio) {
      throw new NotFoundException('Nenhum relatório encontrado');
    }
    //TODO: Handle dates!!!!!!!!!
    //relatorio.updatedAt = relatorio.updatedAt.toISOString();
    return relatorio;
  }

  @Get()
  async findByProdutorId(@Query('produtorId') produtorId: string) {
    try {
      const relatorios = await this.relatorioService.findMany(produtorId);
      if (!relatorios) {
        throw new NotFoundException('Nenhum relatório encontrado');
      }

      return relatorios;
    } catch (error) {
      this.logger.error(
        '🚀 ~ file: relatorios.controller.ts:85 ~ get ~ error:' + error.message,
        error.trace,
      );
      throw new InternalServerErrorException(error.message);
    }
  }

  @Get('/pdf/:id')
  async generatePdf(@Param('id') id: string, @Res() res: Response) {
    try {
      const {
        relatorio,
        perfilPDFModel,
        nome_propriedade,
        dados_producao_agro_industria,
        dados_producao_in_natura,
      } = await this.relatorioService.createPDFInput(id);

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

      console.log('🚀 ...done!! ');
    } catch (error) {
      this.logger.error(
        '🚀 ~ file: relatorios.controller.ts:118 ~ genPDF ~ error:' +
          error.message,
        error.trace,
      );
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Erro ao gerar PDF');
    }
  }

  @Get('/zip/create')
  async generateZip() {
    try {
      const result = this.relatorioService.createZipFile();
      return result;
    } catch (error) {
      console.log('🚀 - RelatorioController - generateZip - error:', error);
      this.logger.error(
        '🚀 ~ file: relatorios.controller.ts:118 ~ genPDF ~ error:' +
          error.message,
        error.trace,
      );
      throw new InternalServerErrorException('Erro ao gerar zip');
    }
  }

  @Header('Content-Type', 'application/zip')
  @Get('/zip/download')
  async downloadZip(@Res() res: Response) {
    try {
      const yesterday = getYesterdayStringDate();
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="PNAE - Relatórios não enviados até ${yesterday}.zip"`,
      );

      const zipStream = await this.relatorioService.downloadRelatorioZip();
      zipStream.pipe(res);
    } catch (error) {
      console.log('🚀 - RelatorioController - generateZip - error:', error);
      this.logger.error(
        '🚀 ~ file: relatorios.controller.ts:174 ~ genPDF ~ error:' +
          error.message,
        error.trace,
      );
      res.send('Erro ao gerar zip');
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
  ) {
    try {
      const relatorioUpdate = { id, ...update };

      //  Needed to get files folder name where to save updated files, if present.
      if (!update.produtorId || !update.contratoId) {
        const relatorio = await this.relatorioService.findOne(id);
        if (!relatorio) {
          throw new NotFoundException('Relatório não encontrado');
        }
        Object.assign(relatorioUpdate, {
          produtorId: update.produtorId || relatorio.produtorId,
          contratoId: update.contratoId || relatorio.contratoId,
        });
      }

      const newAtendimentoId = await this.relatorioService.update(
        relatorioUpdate,
      );

      if (files && Object.keys(files).length > 0) {
        await this.fileService.update(files, relatorioUpdate);
      }
      return newAtendimentoId;
    } catch (error) {
      this.logger.error(
        '🚀 ~ file: relatorios.controller.ts:147 ~ update ~ error:' +
          error.message,
        error.trace,
      );
      throw error;
    }
  }

  @Delete(':id')
  async remove(@Req() req: Request, @Param('id') id: string) {
    try {
      if (!id) throw new BadRequestException('Id inválido');
      const userIP = req.headers['x-real-ip'] || req.headers['x-forwarded-for'];

      const result = await this.relatorioService.remove(id);

      this.logger.error(`#### DELETED RELATORIO ${id}. User IP: ${userIP}`, ''); // Not an error, use method to write to log file.

      return result;
    } catch (error) {
      this.logger.error(
        '####### ~ file: relatorios.controller.ts:161 ~ remove ~ error:' +
          error.message,
        error.trace,
      );
      throw error;
    }
  }
}

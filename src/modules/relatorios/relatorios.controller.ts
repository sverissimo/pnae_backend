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
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { FileService } from 'src/common/files/file.service';
import { RelatorioService } from './relatorios.service';
import { pdfGen } from 'src/@pdf-gen/pdf-gen';
import { FilesInputDto } from 'src/common/files/files-input.dto';
import { RelatorioModel } from 'src/@domain/relatorio/relatorio-model';
import { WinstonLoggerService } from 'src/common/logging/winston-logger.service';
import * as archiver from 'archiver';

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
  async create(@UploadedFiles() files: FilesInputDto, @Body() relatorio: RelatorioModel) {
    try {
      relatorio.readOnly = String(relatorio.readOnly) === 'true';
      const { id: relatorioId } = await this.relatorioService.create(relatorio);

      if (files) {
        await this.fileService.save(files, relatorio);
      }
      console.log('🚀 relatorios.controller.ts:50 ~ created id ', relatorioId);
      return relatorioId;
    } catch (error) {
      this.logger.error(
        '🚀 ~ file: relatorios.controller.ts:53 ~ create ~ error:' + error.message,
        error.trace,
      );
      throw error;
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

      const pdfStream = await pdfGen({
        relatorio,
        perfilPDFModel,
        nome_propriedade,
        dados_producao_agro_industria,
        dados_producao_in_natura,
      });
      pdfStream.pipe(res);
      console.log('🚀 ...done ');
    } catch (error) {
      this.logger.error(
        '🚀 ~ file: relatorios.controller.ts:118 ~ genPDF ~ error:' + error.message,
        error.trace,
      );
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Erro ao gerar PDF');
    }
  }

  // @Header('Content-Type', 'application/pdf')
  // @Header('Content-Disposition', 'attachment; filename="relatorios.pdf"')
  @Get('/zip/:id')
  async generateZip(@Param('id') id: string, @Res() res: Response) {
    try {
      const {
        relatorio,
        perfilPDFModel,
        nome_propriedade,
        dados_producao_agro_industria,
        dados_producao_in_natura,
      } = await this.relatorioService.createPDFInput(id);

      const { numeroRelatorio, produtor } = relatorio;

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader(
        'Content-Disposition',
        `inline; filename=relatorio_${produtor.nomeProdutor}_${numeroRelatorio}.zip`,
      );

      const archive = archiver('zip', {
        zlib: { level: 9 }, // Compression level
      });

      for (let i = 0; i < 3; i++) {
        const chunks = [];
        const pdfStream = await pdfGen({
          relatorio,
          perfilPDFModel,
          nome_propriedade,
          dados_producao_agro_industria,
          dados_producao_in_natura,
        });

        await new Promise<void>((resolve, reject) => {
          pdfStream.on('data', (chunk) => chunks.push(chunk));
          pdfStream.on('end', () => {
            const completePdfFile = Buffer.concat(chunks);
            archive.append(completePdfFile, { name: `relatório${i}.pdf` });
            resolve();
          });
          pdfStream.on('error', reject);
        });
      }

      archive.pipe(res);
      archive.finalize();
      console.log('🚀 ...done ');
    } catch (error) {
      console.log('🚀 - RelatorioController - generateZip - error:', error);
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
    @Body() update: Omit<RelatorioModel, 'id'>,
  ) {
    try {
      const relatorioUpdate = { id, ...update };
      const newAtendimentoId = await this.relatorioService.update(relatorioUpdate);

      if (files && Object.keys(files).length > 0) {
        await this.fileService.update(files, relatorioUpdate);
      }
      return newAtendimentoId;
    } catch (error) {
      this.logger.error(
        '🚀 ~ file: relatorios.controller.ts:147 ~ update ~ error:' + error.message,
        error.trace,
      );
      throw error;
    }
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    try {
      if (!id) throw new BadRequestException('Id inválido');
      const result = await this.relatorioService.remove(id);
      return result;
    } catch (error) {
      this.logger.error(
        '🚀 ~ file: relatorios.controller.ts:161 ~ update ~ error:' + error.message,
        error.trace,
      );
      throw error;
    }
  }
}

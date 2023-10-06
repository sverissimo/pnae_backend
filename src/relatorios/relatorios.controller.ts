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
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { FileService } from 'src/common/file.service';
import { RelatorioService } from './relatorios.service';
import { pdfGen } from 'src/@pdf-gen/pdf-gen';
import { CreateRelatorioDto } from './dto/create-relatorio.dto';
import { UpdateRelatorioDto } from './dto/update-relatorio.dto';
import { FilesInputDto } from 'src/common/files-input.dto';

@Controller('relatorios')
export class RelatorioController {
  constructor(
    private readonly relatorioService: RelatorioService,
    private readonly fileService: FileService,
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
    @Body() createRelatorioDto: CreateRelatorioDto,
  ) {
    try {
      console.log(
        '🚀 ~ file: relatorios.controller.ts:46 ~ RelatorioController ~ createRelatorioDto:',
        createRelatorioDto,
      );
      const { id: relatorioId } = await this.relatorioService.create(createRelatorioDto);
      if (files) {
        await this.fileService.save(files, relatorioId);
      }
      console.log(
        '🚀 ~ file: relatorios.controller.ts:54 ~ RelatorioController ~ relatorioId:',
        relatorioId,
      );
      return relatorioId;
    } catch (error) {
      console.log('🚀 ~ relatorios.controller.ts:52:', error);
      return error;
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
    console.log(
      '🚀 ~ file: relatorios.controller.ts:73 ~ RelatorioController ~ findByProdutorId ~ produtorId:',
      produtorId,
    );
    const relatorio = await this.relatorioService.findMany(produtorId);
    if (!relatorio) {
      throw new NotFoundException('Nenhum relatório encontrado');
    }
    return relatorio;
  }

  @Get('/pdf/:id')
  async generatePdf(@Param('id') id: string, @Res() res: Response) {
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
    @Body() update: Omit<UpdateRelatorioDto, 'id'>,
  ) {
    try {
      const updatedRelatorio = await this.relatorioService.update({ id, ...update });
      if (!updatedRelatorio) {
        throw new NotFoundException(`Relatorio com id ${id} não encontrado.`);
      }
      if (files && Object.keys(files).length > 0) {
        console.log('🚀 ~ file: relatorios.controller.ts:121 ~ generatePdf ~ files:', files);
        await this.fileService.update(files, id);
      }
      return updatedRelatorio;
    } catch (error) {
      console.log('🚀 ~ file: relatorios.controller.ts:67 ~ update ~ error:', error);
      throw error;
    }
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    if (!id) throw new BadRequestException('Id inválido');
    const result = await this.relatorioService.remove(id);
    console.log(
      '🚀 ~ file: relatorios.controller.ts:150 ~ RelatorioController ~ remove ~ result:',
      result,
    );
    return result;
  }
}

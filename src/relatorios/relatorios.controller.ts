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
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { FileService } from 'src/common/file.service';
import { RelatorioService } from './relatorios.service';
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
      { name: 'foto', maxCount: 10 },
      { name: 'assinatura', maxCount: 1 },
    ]),
  )
  async create(
    @UploadedFiles() files: FilesInputDto,
    @Body() createRelatorioDto: CreateRelatorioDto,
  ) {
    try {
      const { id: relatorioId } = await this.relatorioService.create(createRelatorioDto);
      if (files) {
        await this.fileService.save(files, relatorioId);
      }
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
    const relatorio = await this.relatorioService.findOne(+id);
    if (!relatorio) {
      throw new NotFoundException('Nenhum relatório encontrado');
    }
    return relatorio;
  }

  @Get()
  async findByProdutorId(@Query('produtorId') produtorId: number) {
    const relatorio = await this.relatorioService.findMany(+produtorId);
    if (!relatorio) {
      throw new NotFoundException('Nenhum relatório encontrado');
    }
    return relatorio;
  }

  @Get('/pdf/:id')
  async getPDF(@Param('id') relatorioId: number) {
    try {
      const relatorio = await this.relatorioService.createPDF(+relatorioId);
      return relatorio;
    } catch (error) {
      console.log('🚀 relatorios.controller.ts:88 ~ getPDF ~ error:', error);
      throw new InternalServerErrorException(error.message); // or throw new InternalServerErrorException(error.message);
    }
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() update: Omit<UpdateRelatorioDto, 'id'>) {
    try {
      const updatedRelatorio = await this.relatorioService.update({ id: +id, ...update });
      if (!updatedRelatorio) {
        throw new NotFoundException(`Relatorio com id ${id} não encontrado.`);
      }
      return updatedRelatorio;
    } catch (error) {
      console.log('🚀 ~ file: relatorios.controller.ts:67 ~ update ~ error:', error);
      throw new BadRequestException(error.message); // or throw new InternalServerErrorException(error.message);
    }
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    try {
      if (!+id) throw new BadRequestException('Id inválido');
      const result = await this.relatorioService.remove(+id);
      return result;
    } catch (error) {
      console.log('🚀 ~ file: relatorios.controller.ts:67 ~ update ~ error:', error);
      throw new BadRequestException(error.message); // or throw new InternalServerErrorException(error.message);
    }
  }
}

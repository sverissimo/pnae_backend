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
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { RelatorioService } from './relatorios.service';
import { CreateRelatorioDto } from './dto/create-relatorio.dto';
import { UpdateRelatorioDto } from './dto/update-relatorio.dto';
import { FileService } from 'src/common/file.service';
import { FilesInputDto } from 'src/common/files-input.dto';
import { pdfGen } from 'src/@pdf-gen/pdf-gen';
import { Relatorio } from './entities/relatorio.entity';

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
      console.log('🚀 ~ file: relatorios.controller.ts:52 ~ RelatorioController ~ error:', error);
      return error;
    }
  }
  @Get('/all')
  async findAll() {
    const tst: Partial<Relatorio> = {
      pictureURI: '6ae231ac-46f2-4435-b213-c9f85563a663',
      assinaturaURI: '30db3a9d-5025-4f47-bdbd-477d573db490',
    };
    await pdfGen(tst);
    return 'wtv';
    return this.relatorioService.findAll();
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
      /* const relatorio = await this.relatorioService.findOne(+id);
      if (!relatorio) {
        throw new NotFoundException(`Relatorio com id ${id} não encontrado.`);
      } */
      /* const { files } = relatorio;
      if (files && files.length > 0) {
        const fileIds = files.map((f) => f.id);
        await this.fileService.remove(fileIds, process.env.FILES_FOLDER);
      } */
      const result = await this.relatorioService.remove(+id);
      return result;
    } catch (error) {
      console.log('🚀 ~ file: relatorios.controller.ts:67 ~ update ~ error:', error);
      throw new BadRequestException(error.message); // or throw new InternalServerErrorException(error.message);
    }
  }
}

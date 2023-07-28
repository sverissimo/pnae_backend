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
  Res,
  Query,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { RelatorioService } from './relatorios.service';
import { CreateRelatorioDto } from './dto/create-relatorio.dto';
import { UpdateRelatorioDto } from './dto/update-relatorio.dto';
import { FileService } from 'src/common/file.service';
import { Response } from 'express';
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
      { name: 'fotos', maxCount: 10 },
      { name: 'assinatura', maxCount: 1 },
    ]),
  )
  async create(
    @UploadedFiles() files: FilesInputDto,
    @Body() createRelatorioDto: CreateRelatorioDto,
  ) {
    const visitaId = await this.relatorioService.create(createRelatorioDto);
    if (files) {
      await this.fileService.save(files, visitaId);
    }
    return visitaId;
  }

  @Get('/all')
  findAll() {
    return this.relatorioService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.relatorioService.findOne(+id);
  }

  @Get()
  findByProdutorId(@Query('produtorId') produtorId: number) {
    return this.relatorioService.findMany(produtorId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateRelatorioDto: UpdateRelatorioDto) {
    return this.relatorioService.update(+id, updateRelatorioDto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Res() res: Response) {
    try {
      const relatorio = await this.relatorioService.findOne(+id);
      if (!relatorio.length) {
        return res.status(404).end();
      }

      const { files } = relatorio[0];
      const fileIds = files.map((f) => f.id);
      await this.fileService.remove(fileIds, process.env.FILES_FOLDER);
      await this.relatorioService.remove(+id);
      return res.status(204).end();
    } catch (error) {
      return res.status(500).send(error.message);
    }
  }
}

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
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { VisitasService } from './visitas.service';
import { CreateVisitaDto } from './dto/create-visita.dto';
import { UpdateVisitaDto } from './dto/update-visita.dto';
import { FileService } from 'src/common/file.service';
import { VisitaFilesDto } from './dto/files.dto';
import { Response } from 'express';
import { FilesInputDto } from 'src/common/files-input.dto';

@Controller('visitas')
export class VisitasController {
  constructor(
    private readonly visitasService: VisitasService,
    private readonly fileService: FileService,
  ) {}

  @Post()
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'fotos', maxCount: 10 },
      { name: 'assinatura', maxCount: 1 },
    ]),
  )
  async create(@UploadedFiles() files: FilesInputDto, @Body() createVisitaDto: CreateVisitaDto) {
    createVisitaDto.propriedadeId = Number(createVisitaDto.propriedadeId);
    const visitaId = await this.visitasService.create(createVisitaDto);

    if (files) {
      await this.fileService.save(files, visitaId);
    }
    return visitaId;
  }

  @Get()
  findAll() {
    return this.visitasService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.visitasService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateVisitaDto: UpdateVisitaDto) {
    return this.visitasService.update(+id, updateVisitaDto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Res() res: Response) {
    try {
      const visita = await this.visitasService.findOne(+id);

      if (!visita.length) {
        return res.status(404).end();
      }

      const { files } = visita[0];
      const fileIds = files.map((f) => f.id);
      await this.fileService.remove(fileIds, process.env.FILES_FOLDER);
      await this.visitasService.remove(+id);
      return res.status(204).end();
    } catch (error) {
      return res.status(500).send(error.message);
    }
  }
}

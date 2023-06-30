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
} from '@nestjs/common';
import { VisitasService } from './visitas.service';
import { CreateVisitaDto } from './dto/create-visita.dto';
import { UpdateVisitaDto } from './dto/update-visita.dto';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { FileService } from 'src/common/file.service';
import { Visita } from './entities/visita.entity';
import { FileDto } from './dto/files.dto';

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
  async create(
    @UploadedFiles()
    files: FileDto,
    @Body() createVisitaDto: CreateVisitaDto,
  ) {
    const visitaId = await this.visitasService.create(createVisitaDto);

    if (files) {
      await this.fileService.save(files, visitaId); //TODO: IMPLEMENT THIS
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
  remove(@Param('id') id: string) {
    return this.visitasService.remove(+id);
  }
}

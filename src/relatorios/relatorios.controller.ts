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
import { VisitasService } from './relatorios.service';
import { CreateRelatorioDto } from './dto/create-relatorio.dto';
import { UpdateRelatorioDto } from './dto/update-relatorio.dto';
import { FileService } from 'src/common/file.service';
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
  async create(
    @UploadedFiles() files: FilesInputDto,
    @Body() createRelatorioDto: CreateRelatorioDto,
  ) {
    createRelatorioDto.propriedadeId = Number(createRelatorioDto.propriedadeId);
    const visitaId = await this.visitasService.create(createRelatorioDto);
    if (files) {
      await this.fileService.save(files, visitaId);
    }
    return visitaId;
  }

  @Get('api')
  async tst() {
    try {
      const bd = {
        query:
          'query Produtor($id: Int, $cpf: String) {\r\n  produtor(id: $id, cpf: $cpf), {    \r\n    nm_pessoa\r\n    propriedades {\r\n      nome_propriedade\r\n    }\r\n  }\r\n}',
        variables: {
          id: 700002,
          cpf: '45826560649',
        },
        operationName: 'Produtor',
      };
      //const fk = await fetch('http://localhost:4000', {

      const fk = await fetch('http://172.17.0.1:4000', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(bd),
      });
      const fk2 = await fk.json();
      console.log('🚀 ~ file: visitas.controller.ts:60 ~ VisitasController ~ tst ~ fk2:', fk2);
      return fk2;
    } catch (error) {
      console.error(error);
      throw new Error(error.message);
    }
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
  update(@Param('id') id: string, @Body() updateRelatorioDto: UpdateRelatorioDto) {
    return this.visitasService.update(+id, updateRelatorioDto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Res() res: Response) {
    try {
      const relatorio = await this.visitasService.findOne(+id);

      if (!relatorio.length) {
        return res.status(404).end();
      }

      const { files } = relatorio[0];
      const fileIds = files.map((f) => f.id);
      await this.fileService.remove(fileIds, process.env.FILES_FOLDER);
      await this.visitasService.remove(+id);
      return res.status(204).end();
    } catch (error) {
      return res.status(500).send(error.message);
    }
  }
}

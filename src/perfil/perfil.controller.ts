import { Controller, Get, Post, Body, Patch, Param, Delete, Query, Res } from '@nestjs/common';
import { PerfilService } from './perfil.service';
import { CreatePerfilDto } from './dto/create-perfil.dto';
import { UpdatePerfilDto } from './dto/update-perfil.dto';
import { Response } from 'express';
import { RestAPI } from 'src/@rest-api-server/rest-api.service';

@Controller('perfil')
export class PerfilController {
  constructor(private readonly perfilService: PerfilService, private readonly restAPI: RestAPI) {}

  @Post()
  async create(@Body() createPerfilDto: CreatePerfilDto, @Res() res: Response) {
    try {
      const result = await this.perfilService.create(createPerfilDto);
      return res.send(result);
    } catch (error) {
      console.log('🚀 ~ file: perfil.controller.ts:17 ~ PerfilController ~ create ~ error:', error);
      return res.status(500).send(error);
    }
  }

  @Get('/all')
  findAll() {
    return this.perfilService.findAll();
  }

  @Get('/options')
  getPerfilOprions() {
    return this.restAPI.getPerfilOptions();
  }

  @Get()
  async findByProdutorId(@Query('produtorId') produtorId: string, @Res() res: Response) {
    try {
      const perfis = await this.perfilService.findByProdutorId(+produtorId);
      return res.send(perfis);
    } catch (error) {
      const { status, ...err } = error.response;
      return res.status(500).send(err);
    }
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const localPerfil = await this.perfilService.findOne(+id);
    return localPerfil;
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updatePerfilDto: UpdatePerfilDto) {
    return this.perfilService.update(+id, updatePerfilDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.perfilService.remove(+id);
  }
}

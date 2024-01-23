import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  Res,
  InternalServerErrorException,
} from '@nestjs/common';
import { PerfilService } from './perfil.service';
import { CreatePerfilDto } from './dto/create-perfil.dto';
import { UpdatePerfilDto } from './dto/update-perfil.dto';
import { Response } from 'express';
import { PerfilModel } from './entities';

@Controller('perfil')
export class PerfilController {
  constructor(private readonly perfilService: PerfilService) {}

  @Post()
  async create(@Body() createPerfilDto: PerfilModel) {
    try {
      const result = await this.perfilService.create(createPerfilDto);
      console.log('🚀 - PerfilController - create - result:', result);

      // console.log('🚀 - PerfilController - create - result:', JSON.stringify(result, null, 2));
      // const result = { data: 'ok' };

      return result || 'Something went wrogn';

      // return res.send(result);
    } catch (error) {
      console.log('🚀 ~ file: perfil.controller.ts:17 ~ PerfilController ~ create ~ error:', error);
      throw new InternalServerErrorException(error.message);
    }
  }

  @Get('/all')
  findAll() {
    return this.perfilService.findAll();
  }

  @Get('/options')
  getPerfilOptions() {
    return this.perfilService.getPerfilOptions();
  }

  @Get('/produtos')
  async getProdutos() {
    return await this.perfilService.getProdutos();
  }

  @Get()
  async findByProdutorId(@Query('produtorId') produtorId: string, @Res() res: Response) {
    try {
      const perfis = await this.perfilService.findByProdutorId(produtorId);
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

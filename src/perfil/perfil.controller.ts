import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { PerfilService } from './perfil.service';
import { CreatePerfilDto } from './dto/create-perfil.dto';
import { UpdatePerfilDto } from './dto/update-perfil.dto';

@Controller('perfil')
export class PerfilController {
  constructor(private readonly perfilService: PerfilService) {}

  @Post()
  create(@Body() createPerfilDto: CreatePerfilDto) {
    return this.perfilService.create(createPerfilDto);
  }

  @Get('/all')
  findAll() {
    return this.perfilService.findAll();
  }

  @Get()
  findByProdutorId(@Query('produtorId') produtorId: string) {
    return this.perfilService.findByProdutorId(+produtorId);
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

import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  InternalServerErrorException,
} from '@nestjs/common';
import { PerfilService } from './perfil.service';
import { UpdatePerfilDto } from '../../@domain/perfil/dto/update-perfil.dto';
import { CreatePerfilInputDto } from 'src/@domain/perfil/dto/create-perfil.dto';

@Controller('perfil')
export class PerfilController {
  constructor(private readonly perfilService: PerfilService) {}

  @Post()
  async create(@Body() createPerfilDto: CreatePerfilInputDto) {
    try {
      const result = await this.perfilService.create(createPerfilDto);
      return result;
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

  @Get('/contractInfo')
  async getContractInfo() {
    return await this.perfilService.getContractInfo();
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

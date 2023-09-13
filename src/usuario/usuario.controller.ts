import { Controller, Get, NotFoundException, Param, Query } from '@nestjs/common';
import { UsuarioGraphQLAPI } from 'src/@graphQL-server/usuario-api.service';
import { PrismaService } from 'src/prisma/prisma.service';

@Controller('usuario')
export class UsuarioController {
  constructor(private readonly api: UsuarioGraphQLAPI) {}

  @Get(':id')
  async find(@Param('id') id?: string, @Query('matricula') matricula?: string) {
    try {
      const { usuarios } = await this.api.getUsuarios({ ids: id, matriculas: matricula });
      if (!usuarios.length) {
        throw new Error('Usuário não encontrado');
      }
      if (usuarios.length === 1) {
        return usuarios[0];
      }
      return usuarios;
    } catch (error) {
      console.log('🚀 ~ file: usuario.controller.ts:26 ~ UsuarioController ~ find ~ error:', error);
      throw new NotFoundException(error.message);
    }
  }

  @Get()
  async findByMatricula(@Query('matricula') matricula: string) {
    try {
      const usuario = await this.find(null, matricula);
      if (!usuario) {
        throw new Error('Usuário não encontrado');
      }
      return usuario;
    } catch (error) {
      console.log('🚀 ~ file: usuario.controller.ts:24 ', error);
      throw new NotFoundException(error.message);
    }
  }

  /* @Get('findMany/:matricula')
  async findManyByMatricula(@Param('matricula') matricula: string) {
    try {
      const matriculas = matricula.split(',');
      if (!matriculas.length) {
        throw new Error('Ids inválidos.');
      }
      const usuarios = await this.api.getUsuarios(matriculas);
      console.log(
        '🚀 ~ file: usuario.controller.ts:39 ~ UsuarioController ~ findManyByMatricula ~ usuarios:',
        usuarios,
      );
      return usuarios;
    } catch (error) {
      console.log('🚀 ~ file: usuario.controller.ts:24 ', error);
      throw new NotFoundException(error.message);
    }
  } */
}

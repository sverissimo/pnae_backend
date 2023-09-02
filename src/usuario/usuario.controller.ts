import { Controller, Get, NotFoundException, Param, Query } from '@nestjs/common';
import { UsuarioGraphQLAPI } from 'src/@graphQL-server/usuario-api.service';
import { PrismaService } from 'src/prisma/prisma.service';

@Controller('usuario')
export class UsuarioController {
  constructor(private readonly api: UsuarioGraphQLAPI) {}

  @Get(':id')
  async findOne(@Param('id') id: string) {
    try {
      const usuario = await this.api.getUsuario(id);
      return usuario;
    } catch (error) {}
  }

  @Get('')
  async findByMatricula(@Query('matricula') matricula: string) {
    console.log(
      '🚀 ~ file: usuario.controller.ts:19 ~ UsuarioController ~ findByMatricula ~ matricula:',
      matricula,
    );

    try {
      const usuario = await this.api.getUsuarioByMatricula(matricula);
      if (!usuario) {
        throw new Error('Usuário não encontrado');
      }
      return usuario;
    } catch (error) {
      console.log('🚀 ~ file: usuario.controller.ts:24 ', error);
      throw new NotFoundException(error.message);
    }
  }
}

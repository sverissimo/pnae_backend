import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
} from '@nestjs/common';
import { UsuarioGraphQLAPI } from 'src/@graphQL-server/usuario-api.service';
import { getPerfisUsuarios } from 'src/utils';

@Controller('usuario')
export class UsuarioController {
  constructor(private readonly api: UsuarioGraphQLAPI) {}

  @Get(':id')
  async find(@Param('id') id?: string, @Query('matricula') matricula?: string) {
    if (!id && !matricula) {
      throw new BadRequestException('É necessário informar um id ou matricula');
    }
    let { usuarios } = await this.api.getUsuarios({ ids: id, matriculas: matricula });

    if (!usuarios?.length) {
      const { usuarios: comissionados } = await this.api.getUsuarios({
        ids: id,
        matriculas: matricula.length === 4 ? 'C' + matricula : matricula,
      });
      console.log(
        '🚀 ~ file: usuario.controller.ts:29 ~ UsuarioController ~ find ~ comissionados:',
        comissionados,
      );
      if (!comissionados?.length) {
        throw new NotFoundException('Usuário não encontrado');
      }
      usuarios = comissionados;
    }

    const usuariosWithPerfis = getPerfisUsuarios(usuarios);
    return usuarios.length === 1 ? usuariosWithPerfis[0] : usuariosWithPerfis;
  }

  @Get()
  async findByMatricula(@Query('matricula') matricula: string) {
    const usuarios = await this.find(null, matricula);
    return usuarios;
  }
}

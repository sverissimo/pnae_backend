import {
  BadRequestException,
  Body,
  Controller,
  Get,
  InternalServerErrorException,
  NotFoundException,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { UsuarioGraphQLAPI } from 'src/@graphQL-server/usuario-api.service';
import { getPerfisUsuarios } from 'src/utils';
import { UsuarioLdapService } from './usuario.ldap.service';
import { UserNotFoundError } from './errors/user-not-found.error';
import { Usuario } from './entity/usuario-model';

@Controller('usuario')
export class UsuarioController {
  constructor(
    private readonly userLdapService: UsuarioLdapService,
    private readonly api: UsuarioGraphQLAPI,
  ) {}

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

  @Post('/login')
  async login(@Body() user: Partial<Usuario & { password: string }>) {
    try {
      if (!user.matricula_usuario || !user.password) {
        throw new NotFoundException('Usuário não encontrado');
      }
      const { matricula_usuario, password } = user;
      const login = matricula_usuario.length === 4 ? 'C' + matricula_usuario : matricula_usuario;

      const authenticated = await this.userLdapService.authenticate(login, password);

      if (authenticated) {
        const user = await this.api.getUsuarios({ matriculas: login });

        if (!user?.usuarios?.length) throw new InternalServerErrorException();

        const usuariosWithPermissions = getPerfisUsuarios(user?.usuarios);
        const [usuario] = usuariosWithPermissions;
        return usuario;
      }
    } catch (error) {
      if (error instanceof UserNotFoundError) {
        throw new NotFoundException(error.message);
      }
      if (error.message === 'Usuário ou senha inválidos.') {
        throw new BadRequestException('Usuário ou senha inválidos.');
      }
      console.log('🚀 - UsuarioController - login - error:', error);
      throw error;
    }
  }
}

import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { UsuarioGraphQLAPI } from 'src/@graphQL-server/usuario-api.service';
import { RestAPI } from 'src/@rest-api-server/rest-api.service';
import {
  UsuarioGQLOutputDto,
  UsuarioLoginOutputDto,
} from './dto/usuario.gql-output-dto';

@Injectable()
export class UsuarioService {
  constructor(
    private readonly api: UsuarioGraphQLAPI,
    private readonly restAPI: RestAPI,
  ) {}
  async find(id?: string, matricula?: string) {
    const sanitizedMatricula = matricula?.trim() || undefined;

    if (!id && !sanitizedMatricula) {
      throw new BadRequestException('É necessário informar um id ou matricula');
    }
    let { usuarios } = (await this.api.getUsuarios({
      ids: id,
      matriculas: sanitizedMatricula,
    })) as { usuarios: UsuarioGQLOutputDto[] };

    if (!usuarios?.length && sanitizedMatricula) {
      const normalizedMatricula = this.normalizeMatricula(sanitizedMatricula);

      if (normalizedMatricula !== sanitizedMatricula) {
        const fallback = await this.api.getUsuarios({
          ids: id,
          matriculas: normalizedMatricula,
        });
        usuarios = fallback?.usuarios;
      }
    }

    if (!usuarios?.length) {
      throw new NotFoundException('Usuário não encontrado');
    }

    const usuariosWithPerfis = this.getPerfisUsuarios(usuarios);
    return usuarios.length === 1 ? usuariosWithPerfis[0] : usuariosWithPerfis;
  }

  async login(user: { matricula_usuario?: string; password?: string }) {
    const { matricula_usuario, password } = user;
    if (!matricula_usuario || !password) {
      throw new BadRequestException('É necessário informar matrícula e senha.');
    }

    const matricula = this.normalizeMatricula(matricula_usuario);
    const usuario = (await this.restAPI.login({
      matricula,
      password,
    })) as UsuarioLoginOutputDto | null;

    if (!usuario?.id_usuario) {
      throw new UnauthorizedException('Usuário ou senha inválidos.');
    }
    // usuario.id_usuario = 'some_id'; // for testing purposes
    // usuario.perfis = [PerfilUsuario.ADMINISTRADOR2];
    // usuario.perfis = [PerfilUsuario.MOD_ATIV_TECNICO];
    // usuario.id_und_empresa = 'G0040';
    return usuario;
  }

  private getPerfisUsuarios(usuarios: any[]) {
    if (!usuarios) return [];
    const perfis = usuarios.map((u) =>
      u.perfil_demeter.map((p) => p.perfil?.descricao_perfil),
    );
    const usuariosWithPerfis = usuarios.map((u, index) => {
      const { perfil_demeter, ...rest } = u;
      return { ...rest, perfis: perfis[index] };
    });
    return usuariosWithPerfis;
  }

  private normalizeMatricula(matricula: string): string {
    const trimmed = String(matricula ?? '').trim();
    return trimmed.length === 4 ? `C${trimmed}` : trimmed;
  }
}

import { Injectable } from '@nestjs/common';
import { GraphQLAPI } from './GraphQLAPI';
import { getUsuariosQuery, usuarioByMatriculaQuery, usuarioQuery } from './queries';

type GetUsuariosQuery = {
  ids?: string;
  matriculas?: string;
};

@Injectable()
export class UsuarioGraphQLAPI extends GraphQLAPI {
  async getUsuario(id: string) {
    const document = usuarioQuery;
    const variables = { id };
    const usuario = (await this.client.request({ document, variables })) as any;

    return usuario?.usuario;
  }

  async getUsuarioByMatricula(matricula_usuario: string) {
    const document = usuarioByMatriculaQuery;
    const variables = { matricula_usuario };
    const { usuario } = (await this.client.request({ document, variables })) as any;
    return usuario;
  }

  async getUsuarios({ ids, matriculas }: GetUsuariosQuery) {
    const document = getUsuariosQuery;
    const variables = { ids, matriculas };
    const usuarios = (await this.client.request({ document, variables })) as any;
    return usuarios;
  }
}

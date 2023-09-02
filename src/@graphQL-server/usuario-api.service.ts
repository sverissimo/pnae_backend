import { Injectable } from '@nestjs/common';
import { GraphQLAPI } from './GraphQLAPI';
import { usuarioByMatriculaQuery, usuarioQuery } from './queries';

@Injectable()
export class UsuarioGraphQLAPI extends GraphQLAPI {
  async getUsuario(id: string) {
    const document = usuarioQuery;
    const variables = { id };
    const { usuario } = (await this.client.request({ document, variables })) as any;
    return usuario;
  }

  async getUsuarioByMatricula(matricula_usuario: string) {
    const document = usuarioByMatriculaQuery;
    const variables = { matricula_usuario };
    const { usuario } = (await this.client.request({ document, variables })) as any;
    return usuario;
  }
}

import { Injectable } from '@nestjs/common';
import { GraphQLAPI } from './GraphQLAPI';
import { usuarioQuery } from './queries';

@Injectable()
export class UsuarioGraphQLAPI extends GraphQLAPI {
  async getUsuario(id: string) {
    const document = usuarioQuery;
    const variables = { id };
    const { usuario } = (await this.client.request({ document, variables })) as any;
    return usuario;
  }
}

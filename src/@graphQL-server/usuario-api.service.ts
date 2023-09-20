import { Injectable } from '@nestjs/common';
import { GraphQLAPI } from './GraphQLAPI';
import { getUsuariosQuery } from './queries';

type GetUsuariosQuery = {
  ids?: string;
  matriculas?: string;
};

@Injectable()
export class UsuarioGraphQLAPI extends GraphQLAPI {
  async getUsuarios({ ids, matriculas }: GetUsuariosQuery) {
    const document = getUsuariosQuery;
    const variables = { ids, matriculas };
    const usuarios = (await this.client.request({ document, variables })) as any;
    return usuarios;
  }
}

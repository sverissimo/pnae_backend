import { Injectable } from '@nestjs/common';
import {
  createPerfilMutation,
  deletePerfilMutation,
  perfilQuery,
  perfisPorProdutorQuery,
  updatePerfilMutation,
} from './queries';
import { GraphQLAPI } from './GraphQLAPI';

@Injectable()
export class PerfilGraphQLAPI extends GraphQLAPI {
  async getPerfilByProdutorId(produtorId: number) {
    const document = perfisPorProdutorQuery;
    const variables = { produtorId };
    const { perfisPorProdutor } = (await this.client.request({ document, variables })) as any;
    console.log(
      '🚀 ~ file: perfil-api.service.ts:18 ~ PerfilGraphQLAPI ~ getPerfilByProdutorId ~ perfisPorProdutor:',
      perfisPorProdutor,
    );
    return perfisPorProdutor;
  }

  async createPerfil(input: any) {
    try {
      const document = createPerfilMutation;
      const variables = { input };
      const result = (await this.client.request({ document, variables })) as any;
      return result;
    } catch (error) {
      throw new Error(error.message);
    }
  }

  async getPerfis() {
    const document = perfilQuery;
    const result = await this.client.request({ document });
    return result;
  }

  async updatePerfil(id: number, updatePerfilInput: any) {
    const document = updatePerfilMutation;
    const variables = { id, updatePerfilInput };
    const result = await this.client.request({ document, variables });
    console.log(
      '🚀 ~ file: graphql-api.service.ts:54 ~ GraphQLApiGateway ~ updatePerfil ~ variables:',
      variables,
    );
    return result;
  }

  async deletePerfil(id: number) {
    try {
      const document = deletePerfilMutation;
      const variables = { id };
      const result = (await this.client.request({ document, variables })) as any;
      return result;
    } catch (error) {
      throw new Error(error.message);
    }
  }
}

import { GraphQLClient, request } from 'graphql-request';
import { produtorQuery } from './queries';
import {
  createPerfilMutation,
  deletePerfilMutation,
  perfilQuery,
  perfisPorProdutorQuery,
  updatePerfilMutation,
} from './perfil-queries';
import { ConfigService } from '@nestjs/config';
import { Injectable } from '@nestjs/common';

@Injectable()
export class GraphQLApiGateway {
  client: GraphQLClient;
  url: string;

  constructor(private configService: ConfigService) {
    const token = this.configService.get('token');
    const url = this.configService.get('url');

    this.client = new GraphQLClient(url, {
      headers: {
        authorization: 'Bearer ' + token,
      },
    });
  }

  async getProdutor(cpfProdutor: string) {
    const document = produtorQuery;
    const variables = { cpf: cpfProdutor };
    const result = await this.client.request({ document, variables });
    return result;
  }

  async getPerfilByProdutorId(produtorId: number) {
    const document = perfisPorProdutorQuery;
    const variables = { produtorId };
    const { perfisPorProdutor } = (await this.client.request({ document, variables })) as any;
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

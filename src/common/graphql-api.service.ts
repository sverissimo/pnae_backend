import { GraphQLClient, request } from 'graphql-request';
import { perfilQuery, perfisPorProdutorQuery, produtorQuery } from './queries';

export class GraphQLApiGateway {
  client: GraphQLClient;
  url: string;
  constructor(url) {
    this.url = url || 'http://172.17.0.1:4000';
    this.client = new GraphQLClient(this.url);
  }

  async getProdutor(cpfProdutor: string) {
    const document = produtorQuery;
    const variables = { cpf: cpfProdutor };
    const result = await request({ url: this.url, document, variables });
    return result;
  }

  async getPerfilByProdutorId(produtorId: number) {
    const document = perfisPorProdutorQuery;
    const variables = { produtorId };
    const { perfisPorProdutor } = (await request({ url: this.url, document, variables })) as any;
    return perfisPorProdutor;
  }

  async getPerfis() {
    const document = perfilQuery;
    const result = await request({ url: this.url, document });
    return result;
  }
}

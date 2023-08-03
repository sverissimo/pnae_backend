import { Injectable } from '@nestjs/common';
import { produtorQuery } from './queries';
import { GraphQLAPI } from './GraphQLAPI';

@Injectable()
export class ProdutorGraphQLAPI extends GraphQLAPI {
  async getProdutor(cpfProdutor: string) {
    const document = produtorQuery;
    const variables = { cpf: cpfProdutor };
    const result = await this.client.request({ document, variables });
    return result;
  }
}

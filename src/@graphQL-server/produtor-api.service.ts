import { Injectable } from '@nestjs/common';
import { produtorQuery } from './queries';
import { GraphQLAPI } from './GraphQLAPI';

@Injectable()
export class ProdutorGraphQLAPI extends GraphQLAPI {
  async getProdutor(cpfProdutor: string) {
    const document = produtorQuery;
    const variables = { cpf: cpfProdutor };
    const { produtor } = (await this.client.request({ document, variables })) as any;
    return this.parseBigint(produtor);
  }

  async getProdutorById(id: string): Promise<any> {
    const document = produtorQuery;
    const variables = { id: parseInt(id) };
    const { produtor } = (await this.client.request({ document, variables })) as any;
    return this.parseBigint(produtor);
  }

  private parseBigint(produtor) {
    produtor.id_pessoa_demeter = BigInt(produtor.id_pessoa_demeter);
    return produtor;
  }
}

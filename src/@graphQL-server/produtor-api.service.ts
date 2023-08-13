import { Injectable } from '@nestjs/common';
import { produtorQuery } from './queries';
import { GraphQLAPI } from './GraphQLAPI';
import { Produtor } from '@prisma/client';

@Injectable()
export class ProdutorGraphQLAPI extends GraphQLAPI {
  async getProdutor(cpfProdutor: string) {
    const document = produtorQuery;
    const variables = { cpf: cpfProdutor };
    const { produtor } = (await this.client.request({ document, variables })) as any;
    return this.parseBigint(produtor);
  }
  parseBigint(produtor) {
    produtor.id_pessoa_demeter = BigInt(produtor.id_pessoa_demeter);
    return produtor;
  }
}

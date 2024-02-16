import { Injectable } from '@nestjs/common';
import { produtorQuery, produtorUnidadeEmpresaQuery } from './queries';
import { GraphQLAPI } from './GraphQLAPI';
import { Produtor } from 'src/@domain/produtor/produtor';

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

  async getProdutorUnidadeEmpresaId(id: string): Promise<Partial<Produtor>> {
    const document = produtorUnidadeEmpresaQuery;
    const variables = { produtorId: parseInt(id) };
    const { getUnidadeEmpresa: result } = (await this.client.request({
      document,
      variables,
    })) as any;
    if (!result) {
      throw new Error('Produtor não encontrado ao buscar por unidade da empresa.');
    }
    return result;
  }

  private parseBigint(produtor) {
    produtor.id_pessoa_demeter = BigInt(produtor.id_pessoa_demeter);
    return produtor;
  }
}

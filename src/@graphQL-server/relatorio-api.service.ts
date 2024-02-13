import {
  createRelatorioMutation,
  deleteRelatorioMutation,
  relatorioQuery,
  relatoriosFindAllQuery,
  updateRelatorioMutation,
} from './queries';
import { Injectable } from '@nestjs/common';
import { GraphQLAPI } from './GraphQLAPI';
import { APIService } from './APIService';
import { Relatorio } from 'src/@domain/relatorio/relatorio';

@Injectable()
export class RelatorioGraphQLAPI extends GraphQLAPI implements APIService<Relatorio> {
  async getRelatorio(id: number, cpfProdutor: string): Promise<Relatorio | unknown> {
    const document = relatorioQuery;
    const variables = { id, cpf: cpfProdutor };
    const result = await this.client.request({ document, variables });
    return result;
  }

  async createRelatorio(createRelatorioInput: Partial<Relatorio>): Promise<Relatorio> {
    const document = createRelatorioMutation;
    const variables = { createRelatorioInput };
    const result = await this.client.request({ document, variables });
    return result as Relatorio;
  }

  async updateRelatorio(
    updateRelatorioInput: Partial<Relatorio> & { id: number },
  ): Promise<Relatorio> {
    const document = updateRelatorioMutation;
    const variables = { input: updateRelatorioInput };
    const result = await this.client.request({ document, variables });
    return result as Relatorio;
  }

  async deleteRelatorio(id: number) {
    const document = deleteRelatorioMutation;
    const variables = { id };
    const result = await this.client.request({ document, variables });
    return result;
  }

  async findAll(): Promise<Relatorio[]> {
    const document = relatoriosFindAllQuery;
    const result = await this.client.request({ document });
    return result as Relatorio[];
  }
}

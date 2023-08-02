import { Relatorio } from '@prisma/client';
import { GraphQLApiGateway } from './graphql-api.service';
import {
  createRelatorioMutation,
  deleteRelatorioMutation,
  relatorioQuery,
  updateRelatorioMutation,
} from './queries/relatorio-queries';
import { Injectable } from '@nestjs/common';

@Injectable()
export class RelatorioAPI extends GraphQLApiGateway {
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
}

import { Injectable } from '@nestjs/common';
import { GraphQLAPI } from './GraphQLAPI';
import { createAtendimentoMutation } from './mutations/atendimento-mutations';
import { Atendimento } from 'src/modules/atendimento/entities/atendimento.entity';
import {
  atendimentoQuery,
  atendimentosQuery,
  updateAtendimentoMutation,
} from './queries/atendimento-queries';

@Injectable()
export class AtendimentoGraphQLAPI extends GraphQLAPI {
  async findAll() {
    const query = atendimentosQuery;
    const { atendimentos } = (await this.client.request(query)) as { atendimentos: Atendimento[] };
    return atendimentos;
  }

  async findOne(id: string) {
    const document = atendimentoQuery;
    const variables = { id };
    const { atendimento } = (await this.client.request({ document, variables })) as {
      atendimento: Atendimento;
    };
    return atendimento;
  }

  async createAtendimento(createAtendimentoInput: Atendimento) {
    const document = createAtendimentoMutation;
    const variables = { input: createAtendimentoInput };
    const { id_at_atendimento }: { id_at_atendimento: string } = await this.client.request({
      document,
      variables,
    });

    console.log(
      '🚀 - AtendimentoGraphQLAPI - createAtendimento - id_at_atendimento:',
      id_at_atendimento,
    );

    return id_at_atendimento;
  }

  async update(updateAtendimentoInput: Partial<Atendimento>) {
    const document = updateAtendimentoMutation;
    const variables = { input: updateAtendimentoInput };
    const result = await this.client.request({ document, variables });
    return result;
  }
}

import { Injectable } from '@nestjs/common';
import { GraphQLAPI } from './GraphQLAPI';
import { createAtendimentoMutation } from './mutations/atendimento-mutations';
import { Atendimento } from 'src/atendimento/entities/atendimento.entity';
import { atendimentoQuery } from './queries/atendimento-queries';

@Injectable()
export class AtendimentoGraphQLAPI extends GraphQLAPI {
  async findAll() {
    const query = atendimentoQuery;
    const { atendimentos } = (await this.client.request(query)) as { atendimentos: Atendimento[] };
    return atendimentos;
  }
  async createAtendimento(createAtendimentoInput: Atendimento) {
    const document = createAtendimentoMutation;
    const variables = { input: createAtendimentoInput };
    const result = await this.client.request({ document, variables });
    console.log('🚀 ~ file: atendimento-api.service.ts:12 ~ createAtendimento ~ result:', result);
    return result;
  }
}

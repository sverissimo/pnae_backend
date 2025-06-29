import { Injectable } from '@nestjs/common';
import { GraphQLAPI } from './GraphQLAPI';
import { createAtendimentoMutation } from './mutations/atendimento-mutations';
import { Atendimento } from 'src/modules/atendimento/entities/atendimento.entity';
import {
  atendimentoQuery,
  atendimentosQuery,
  checkDataSEIMutation,
  updateAtendimentoMutation,
} from './queries/atendimento-queries';
import { CreateAtendimentoStorageDto } from 'src/modules/atendimento/dto/create-atendimento.dto';

@Injectable()
export class AtendimentoGraphQLAPI extends GraphQLAPI {
  async findMany(ids: string[]) {
    const document = atendimentosQuery;
    const variables = { ids };
    const { atendimentos } = (await this.client.request({
      document,
      variables,
    })) as {
      atendimentos: Atendimento[];
    };
    return atendimentos;
  }

  async findOne(id: string) {
    const document = atendimentoQuery;
    const variables = { id };
    const { atendimento } = (await this.client.request({
      document,
      variables,
    })) as {
      atendimento: Atendimento;
    };
    return atendimento;
  }

  async createAtendimento(createAtendimentoInput: CreateAtendimentoStorageDto) {
    const document = createAtendimentoMutation;
    const variables = { input: createAtendimentoInput };
    const { id_at_atendimento }: { id_at_atendimento: string } =
      await this.client.request({
        document,
        variables,
      });

    return id_at_atendimento;
  }

  async update(updateAtendimentoInput: Partial<Atendimento>) {
    const document = updateAtendimentoMutation;
    const variables = { input: updateAtendimentoInput };
    const result = await this.client.request({ document, variables });
    return result;
  }

  async registerDataSEI(ids: string[]) {
    const document = checkDataSEIMutation;
    const variables = { atendimentosIds: ids };
    const result = await this.client.request({ document, variables });
    return result;
  }
}

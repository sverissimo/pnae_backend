import { Injectable } from '@nestjs/common';
import { GraphQLAPI } from './GraphQLAPI';
import { createAtendimentoMutation } from './mutations/atendimento-mutations';
import { Atendimento } from 'src/modules/atendimento/entities/atendimento.entity';
import {
  atendimentoQuery,
  atendimentosQuery,
  setAtendimentosExportDateMutation,
  updateAtendimentoMutation,
} from './queries/atendimento-queries';
import { CreateAtendimentoStorageDto } from 'src/modules/atendimento/dto/create-atendimento.dto';

type AtendimentoResponse = { atendimento: Atendimento };
type AtendimentosResponse = { atendimentos: Atendimento[] };

@Injectable()
export class AtendimentoGraphQLAPI extends GraphQLAPI {
  async findMany(ids: string[]): Promise<Atendimento[]> {
    const { atendimentos } = await this.client.request<AtendimentosResponse>(
      atendimentosQuery,
      { ids },
    );
    return atendimentos;
  }

  async findOne(id: string) {
    const { atendimento } = await this.client.request<AtendimentoResponse>(
      atendimentoQuery,
      { id },
    );
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

  async setAtendimentosExportDate(ids: string[]) {
    const result = await this.client.request(
      setAtendimentosExportDateMutation,
      { atendimentosIds: ids },
    );
    console.log('🚀 - setAtendimentosExportDate:', result);
    return result;
  }
}

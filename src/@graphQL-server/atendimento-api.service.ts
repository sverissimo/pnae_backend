import { Injectable } from '@nestjs/common';
import { GraphQLAPI } from './GraphQLAPI';
import { createAtendimentoMutation } from './mutations/atendimento-mutations';
import { Atendimento } from 'src/modules/atendimento/entities/atendimento.entity';
import {
  atendimentoComRelatorioManualQuery,
  atendimentoQuery,
  atendimentosComRelatorioManualQuery,
  atendimentosManuaisUltimos30DiasQuery,
  atendimentosQuery,
  setAtendimentosExportDateMutation,
  updateAtendimentoMutation,
} from './queries/atendimento-queries';
import { CreateAtendimentoStorageDto } from 'src/modules/atendimento/dto/create-atendimento.dto';
import { AtendimentoModel } from 'src/@domain/atendimento/atendimento-model';
import {
  AtendimentoComRelatorioDemeterItemDTO,
  AtendimentoComRelatorioDemeterPageGqlDTO,
  AtendimentoComRelatorioDemeterQueryDTO,
} from 'src/modules/atendimento/dto/atendimento-com-relatorio-demeter.dto';

type AtendimentoResponse = { atendimento: Atendimento };
type AtendimentosResponse = { atendimentos: AtendimentoModel[] };
type AtendimentosComRelatorioDemeterResponse = {
  atendimentosComRelatorioManual: AtendimentoComRelatorioDemeterPageGqlDTO;
};
type AtendimentoComRelatorioDemeterResponse = {
  atendimentoComRelatorioManual: AtendimentoComRelatorioDemeterItemDTO | null;
};
type AtendimentosManuaisUltimos30DiasResponse = {
  atendimentosManuaisUltimos30Dias: string[];
};

@Injectable()
export class AtendimentoGraphQLAPI extends GraphQLAPI {
  async findMany(ids: string[]): Promise<AtendimentoModel[]> {
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

  async getManuaisUltimos30Dias(id_reg_empresa?: string): Promise<string[]> {
    const { atendimentosManuaisUltimos30Dias } =
      await this.client.request<AtendimentosManuaisUltimos30DiasResponse>(
        atendimentosManuaisUltimos30DiasQuery,
        { id_reg_empresa },
      );
    return atendimentosManuaisUltimos30Dias ?? [];
  }

  async getAtendimentosComRelatorioDemeter({
    pageSize,
    cursor,
    id_usuario,
    id_reg_empresa,
  }: AtendimentoComRelatorioDemeterQueryDTO): Promise<AtendimentoComRelatorioDemeterPageGqlDTO> {
    const { atendimentosComRelatorioManual } =
      await this.client.request<AtendimentosComRelatorioDemeterResponse>(
        atendimentosComRelatorioManualQuery,
        { pageSize, cursor, id_usuario, id_reg_empresa },
      );
    return atendimentosComRelatorioManual;
  }

  async getAtendimentoComRelatorioDemeter(
    id: string,
  ): Promise<AtendimentoComRelatorioDemeterItemDTO | null> {
    const { atendimentoComRelatorioManual } =
      await this.client.request<AtendimentoComRelatorioDemeterResponse>(
        atendimentoComRelatorioManualQuery,
        { id },
      );
    return atendimentoComRelatorioManual ?? null;
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

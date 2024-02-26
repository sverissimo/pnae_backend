import { Injectable } from '@nestjs/common';
import { CreateAtendimentoDto } from './dto/create-atendimento.dto';
import { UpdateAtendimentoDto } from './dto/update-atendimento.dto';
import { AtendimentoGraphQLAPI } from 'src/@graphQL-server/atendimento-api.service';
import { Atendimento } from './entities/atendimento.entity';

@Injectable()
export class AtendimentoService {
  constructor(private graphQLAPI: AtendimentoGraphQLAPI) {}

  async create(createAtendimentoDto: CreateAtendimentoDto) {
    const atendimento = new Atendimento(createAtendimentoDto);

    const result = (await this.graphQLAPI.createAtendimento(atendimento)) as unknown as {
      id_at_atendimento: string;
    };

    return result.id_at_atendimento;
  }

  async findAll() {
    const atendimentos = await this.graphQLAPI.findAll();
    return atendimentos;
  }

  async findOne(id: string) {
    return await this.graphQLAPI.findOne(id);
  }

  update(id: number, updateAtendimentoDto: UpdateAtendimentoDto) {
    return `This action updates a #${id} atendimento`;
  }

  async logicRemove(id: string) {
    await this.graphQLAPI.update({ id_at_atendimento: id, ativo: false });
  }
}

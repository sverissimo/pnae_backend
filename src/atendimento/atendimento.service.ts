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

    console.log('🚀 ~ file: atendimento.service.ts:13 ~atendimento:', atendimento);
    const atendimentoId = await this.graphQLAPI.createAtendimento(atendimento);
    return atendimentoId;
  }

  async findAll() {
    const atendimentos = await this.graphQLAPI.findAll();
    return atendimentos;
  }

  findOne(id: number) {
    return `This action returns a #${id} atendimento`;
  }

  update(id: number, updateAtendimentoDto: UpdateAtendimentoDto) {
    return `This action updates a #${id} atendimento`;
  }

  remove(id: number) {
    return `This action removes a #${id} atendimento`;
  }
}

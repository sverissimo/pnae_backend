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
    const atendimento = await this.graphQLAPI.findOne(id);
    const { at_cli_atend_prop, at_atendimento_usuario } = atendimento;
    atendimento.at_cli_atend_prop = at_cli_atend_prop && at_cli_atend_prop[0];
    atendimento.at_atendimento_usuario = at_atendimento_usuario && at_atendimento_usuario[0];
    return atendimento;
  }

  async updateIfNecessary(atendimentoId: string) {
    const atendimento = await this.findOne(atendimentoId);
    if (!atendimento?.sn_pendencia) {
      return;
    }

    await this.graphQLAPI.update({ id_at_atendimento: atendimentoId, ativo: false });

    const { id_und_empresa, link_pdf, at_cli_atend_prop, at_atendimento_usuario } = atendimento;
    const { id_usuario } = at_atendimento_usuario;
    const { id_pessoa_demeter, id_pl_propriedade } = at_cli_atend_prop;

    const createAtendimentoDTO: CreateAtendimentoDto = {
      id_usuario,
      id_und_empresa,
      link_pdf,
      id_pessoa_demeter,
      id_pl_propriedade,
      id_at_anterior: atendimentoId,
    };

    await this.create(createAtendimentoDTO);
  }

  update(id: number, updateAtendimentoDto: UpdateAtendimentoDto) {
    return `This action updates a #${id} atendimento`;
  }

  async logicRemove(id: string) {
    await this.graphQLAPI.update({ id_at_atendimento: id, ativo: false });
  }
}

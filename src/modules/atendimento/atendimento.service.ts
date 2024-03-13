import * as fs from 'fs/promises';
import { Injectable } from '@nestjs/common';
import { CreateAtendimentoDto } from './dto/create-atendimento.dto';
import { UpdateAtendimentoDto } from './dto/update-atendimento.dto';
import { AtendimentoGraphQLAPI } from 'src/@graphQL-server/atendimento-api.service';
import { Atendimento } from './entities/atendimento.entity';
import { RestAPI } from 'src/@rest-api-server/rest-api.service';

@Injectable()
export class AtendimentoService {
  constructor(
    private graphQLAPI: AtendimentoGraphQLAPI,
    private restAPI: RestAPI,
  ) {}

  async create(createAtendimentoDto: CreateAtendimentoDto) {
    const atendimento = Atendimento.create(createAtendimentoDto);

    const newAtendimentoId: string = await this.graphQLAPI.createAtendimento(
      atendimento,
    );
    return newAtendimentoId;
  }

  async findAll() {
    const atendimentos = await this.graphQLAPI.findAll();
    return atendimentos;
  }

  async findOne(id: string) {
    const atendimento = await this.graphQLAPI.findOne(id);
    const { at_cli_atend_prop, at_atendimento_usuario } = atendimento;
    atendimento.at_cli_atend_prop = at_cli_atend_prop && at_cli_atend_prop[0];
    atendimento.at_atendimento_usuario =
      at_atendimento_usuario && at_atendimento_usuario[0];
    return atendimento;
  }

  async getAtendimentosWithoutDataSEI() {
    const atendimentos = await this.restAPI.getAtendimentosWithoutDataSEI();
    return atendimentos;
  }

  async updateIfNecessary(atendimentoId: string, numero_relatorio: string) {
    const atendimento = await this.findOne(atendimentoId);
    if (!atendimento?.sn_pendencia) {
      return;
    }

    const {
      id_und_empresa,
      link_pdf,
      at_cli_atend_prop,
      at_atendimento_usuario,
    } = atendimento;
    const { id_usuario } = at_atendimento_usuario;
    const { id_pessoa_demeter, id_pl_propriedade } = at_cli_atend_prop;

    const atendimentoDTO: CreateAtendimentoDto = {
      id_usuario,
      id_und_empresa,
      link_pdf,
      id_pessoa_demeter,
      id_pl_propriedade,
      numero_relatorio,
      id_at_anterior: atendimentoId,
    };

    await this.logicRemove(atendimentoId);
    const newAtendimento = Atendimento.recreate(atendimentoDTO);
    const newAtendimentoId = await this.graphQLAPI.createAtendimento(
      newAtendimento,
    );

    return newAtendimentoId;
  }

  async update(id: string, updateAtendimentoDto: UpdateAtendimentoDto) {
    await this.graphQLAPI.update({
      id_at_atendimento: id,
      ...updateAtendimentoDto,
    });
  }

  async registerDataSEI() {
    const idsString = await fs.readFile('atendimentosIds.json', 'utf-8');

    const atendimentosIds: string[] = JSON.parse(idsString);
    if (!atendimentosIds.length) {
      return;
    }

    return await this.graphQLAPI.registerDataSEI(atendimentosIds);
  }

  async saveIdsToFile(atendimentosIds: string[]) {
    await fs.writeFile('atendimentosIds.json', JSON.stringify(atendimentosIds));
  }

  async logicRemove(id: string) {
    await this.update(id, { ativo: false });
  }
}

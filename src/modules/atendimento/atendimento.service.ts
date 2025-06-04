import * as fs from 'fs/promises';
import { Injectable } from '@nestjs/common';
import { CreateAtendimentoInputDto } from './dto/create-atendimento.dto';
import { UpdateAtendimentoStorageDto } from './dto/update-atendimento.dto';
import { AtendimentoGraphQLAPI } from 'src/@graphQL-server/atendimento-api.service';
import { Atendimento } from './entities/atendimento.entity';
import { RestAPI } from 'src/@rest-api-server/rest-api.service';
import { AtendimentoDataMapper } from './data-mapper/atendimento.data-mapper';

@Injectable()
export class AtendimentoService {
  constructor(
    private graphQLAPI: AtendimentoGraphQLAPI,
    private restAPI: RestAPI,
  ) {}

  async create(CreateAtendimentoInputDto: CreateAtendimentoInputDto) {
    const atendimento = Atendimento.create(CreateAtendimentoInputDto);
    const createAtendimentoStorageDto =
      AtendimentoDataMapper.entityToCreateStorageDto(atendimento);

    const newAtendimentoId: string = await this.graphQLAPI.createAtendimento(
      createAtendimentoStorageDto,
    );
    return newAtendimentoId;
  }

  async findMany(ids: string[]) {
    const atendimentos = await this.graphQLAPI.findMany(ids);
    const parsedAtendimentos = atendimentos.map((atendimento) => {
      const { at_atendimento_usuario } = atendimento;
      const { usuario } = at_atendimento_usuario && at_atendimento_usuario[0];

      return {
        ...atendimento,
        usuario: usuario?.nome_usuario,
        at_atendimento_usuario: undefined,
      };
    });
    return parsedAtendimentos;
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

  getTemasAtendimento() {
    return this.restAPI.getTemasAtendimento();
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

    const atendimentoDTO: CreateAtendimentoInputDto = {
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
    const newAtendimentoDto =
      AtendimentoDataMapper.entityToCreateStorageDto(newAtendimento);

    const newAtendimentoId = await this.graphQLAPI.createAtendimento(
      newAtendimentoDto,
    );

    return newAtendimentoId;
  }

  async update(
    id: string,
    UpdateAtendimentoInputDto: UpdateAtendimentoStorageDto,
  ) {
    await this.graphQLAPI.update({
      id_at_atendimento: id,
      ...UpdateAtendimentoInputDto,
    });
  }

  updateTemasAtendimento(id: string, temasAtendimento: string): Promise<void> {
    return this.restAPI.updateTemasAtendimento(id, temasAtendimento);
  }

  async registerDataSEI() {
    const zipPath = process.env.ZIP_FILES_PATH;
    const idsString = await fs.readFile(
      `${zipPath}/atendimentosIds.json`,
      'utf-8',
    );

    const atendimentosIds: string[] = JSON.parse(idsString);
    if (!atendimentosIds.length) {
      return;
    }

    return await this.graphQLAPI.registerDataSEI(atendimentosIds);
  }

  async saveIdsToFile(atendimentosIds: string[]) {
    const zipPath = process.env.ZIP_FILES_PATH;
    await fs.writeFile(
      `${zipPath}/atendimentosIds.json`,
      JSON.stringify(atendimentosIds),
    );
  }

  async logicRemove(id: string) {
    await this.update(id, { ativo: false });
  }
}

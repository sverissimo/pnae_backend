import * as fs from 'fs/promises';
import { Injectable } from '@nestjs/common';
import { CreateAtendimentoInputDto } from './dto/create-atendimento.dto';
import { UpdateAtendimentoStorageDto } from './dto/update-atendimento.dto';
import { AtendimentoGraphQLAPI } from 'src/@graphQL-server/atendimento-api.service';
import { Atendimento } from './entities/atendimento.entity';
import { RestAPI } from 'src/@rest-api-server/rest-api.service';
import { AtendimentoDataMapper } from './data-mapper/atendimento.data-mapper';
import { UpdateTemasAndVisitaAtendimentoDTO } from './dto/update-temas-and-visita-atendimento.dto';

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

  updateTemasAndVisita(
    updateAtendimentoProps: UpdateTemasAndVisitaAtendimentoDTO,
  ): Promise<void> {
    const {
      atendimentoId,
      temasAtendimento,
      numeroVisita,
      oldRelatorioNumber,
    } = updateAtendimentoProps;

    const hasNumero = !!numeroVisita;

    const numeroVisitaUpdate =
      hasNumero && numeroVisita !== String(oldRelatorioNumber)
        ? String(numeroVisita)
        : undefined;

    const temasDTO = temasAtendimento
      ? Atendimento.temasAtendimentoListToDTO(temasAtendimento)
      : undefined;

    if (!atendimentoId || (!temasDTO && !numeroVisitaUpdate)) return;
    console.log({
      atendimentoId,
      temasDTO,
      numeroVisitaUpdate,
    });

    return this.restAPI.updateTemasAndVisitaAtendimento({
      atendimentoId,
      temasAtendimento: temasDTO,
      numeroVisita: numeroVisitaUpdate,
    });
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

  // Workaround cause frontEnd doesn't send dates
  async checkDates({
    createdAt,
    atendimentoId,
  }: {
    createdAt: string;
    atendimentoId: string;
  }) {
    if (!createdAt || !atendimentoId) return false;

    const atendimento = await this.findOne(atendimentoId);
    const { data_inicio_atendimento } = atendimento;

    const parsedCreated = new Date(createdAt);
    const parsedInicio = new Date(data_inicio_atendimento);
    const validCreated = !isNaN(parsedCreated.getTime());
    const validInicio = !isNaN(parsedInicio.getTime());

    if (!validInicio && validCreated) {
      await this.update(atendimentoId, {
        data_inicio_atendimento: createdAt,
        data_fim_atendimento: createdAt,
      });
      return true;
    }

    if (!validCreated || !validInicio) return false;

    const d1 = parsedCreated.toISOString().slice(0, 10);
    const d2 = parsedInicio.toISOString().slice(0, 10);
    d1 === d2 && console.log('Dates are the same, no update needed.');
    if (d1 !== d2) {
      console.log('Dates are different, updating atendimento...');
      await this.update(atendimentoId, {
        data_inicio_atendimento: createdAt,
        data_fim_atendimento: createdAt,
      });
      return true;
    }

    return false;
  }
}

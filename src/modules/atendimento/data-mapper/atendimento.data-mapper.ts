import { UnidadeLocalidade } from 'src/cache/cached-municipios.reader';
import {
  AtendimentoComRelatorioManualDTO,
  AtendimentoComRelatorioManualItemDTO,
  AtendimentoComRelatorioManualPageDTO,
  AtendimentoComRelatorioManualPageGqlDTO,
} from '../dto/atendimento-com-relatorio-manual.dto';
import { CreateAtendimentoStorageDto } from '../dto/create-atendimento.dto';
import { Atendimento } from '../entities/atendimento.entity';

export class AtendimentoDataMapper {
  static entityToCreateStorageDto(
    atendimento: Partial<Atendimento>,
  ): CreateAtendimentoStorageDto {
    const {
      at_atendimento_usuario,
      at_cli_atend_prop,
      at_atendimento_indicador,
      at_atendimento_indi_camp_acess,
    } = atendimento;
    return {
      data_inicio_atendimento: atendimento.data_inicio_atendimento,
      data_fim_atendimento: atendimento.data_fim_atendimento,
      data_atualizacao: atendimento.data_atualizacao,
      id_at_status: atendimento.id_at_status,
      ativo: atendimento.ativo,
      id_at_acao: atendimento.id_at_acao,
      id_und_empresa: atendimento.id_und_empresa,
      data_criacao: atendimento.data_criacao,
      id_at_anterior: atendimento.id_at_anterior,
      link_pdf: atendimento.link_pdf,
      sn_pendencia: atendimento.sn_pendencia,
      at_atendimento_usuario,
      at_cli_atend_prop,
      at_atendimento_indicador,
      at_atendimento_indi_camp_acess,
    };
  }

  static toComRelatorioManual(
    item: AtendimentoComRelatorioManualItemDTO,
    localidade?: UnidadeLocalidade,
  ): AtendimentoComRelatorioManualDTO {
    const cliente = item.clientes[0] ?? null;
    const usuario = item.usuarios[0] ?? null;
    const { clientes, usuarios, ...scalars } = item;

    return {
      ...scalars,
      produtor: cliente?.produtor ?? null,
      propriedade: cliente?.propriedade ?? null,
      usuario,
      nomeMunicipio: localidade?.nomeMunicipio ?? null,
      id_reg_empresa: localidade?.id_reg_empresa ?? null,
      nomeRegional: localidade?.nomeRegional ?? null,
    };
  }

  static toComRelatorioManualPage(
    page: AtendimentoComRelatorioManualPageGqlDTO,
    localidadeMap: Map<string, UnidadeLocalidade>,
  ): AtendimentoComRelatorioManualPageDTO {
    return {
      items: page.items.map((item) =>
        this.toComRelatorioManual(
          item,
          localidadeMap.get(item.id_und_empresa),
        ),
      ),
      pageSize: page.pageSize,
      nextCursor: page.nextCursor,
      hasMore: page.hasMore,
    };
  }
}

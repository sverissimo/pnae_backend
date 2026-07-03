import { UnidadeLocalidade } from 'src/cache/cached-municipios.reader';
import {
  AtendimentoComRelatorioDemeterDTO,
  AtendimentoComRelatorioDemeterItemDTO,
  AtendimentoComRelatorioDemeterPageDTO,
  AtendimentoComRelatorioDemeterPageGqlDTO,
} from '../dto/atendimento-com-relatorio-demeter.dto';
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

  static toComRelatorioDemeter(
    item: AtendimentoComRelatorioDemeterItemDTO,
    localidade?: UnidadeLocalidade,
  ): AtendimentoComRelatorioDemeterDTO {
    const cliente = item.clientes[0] ?? null;
    const usuario = item.usuarios[0] ?? null;
    const { clientes, usuarios, arquivos, ...scalars } = item;

    return {
      ...scalars,
      arquivos: arquivos ?? [],
      produtor: cliente?.produtor ?? null,
      propriedade: cliente?.propriedade ?? null,
      usuario,
      nomeMunicipio: localidade?.nomeMunicipio ?? null,
      id_reg_empresa: localidade?.id_reg_empresa ?? null,
      nomeRegional: localidade?.nomeRegional ?? null,
    };
  }

  static toComRelatorioDemeterPage(
    page: AtendimentoComRelatorioDemeterPageGqlDTO,
    localidadeMap: Map<string, UnidadeLocalidade>,
  ): AtendimentoComRelatorioDemeterPageDTO {
    return {
      items: page.items.map((item) =>
        this.toComRelatorioDemeter(
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

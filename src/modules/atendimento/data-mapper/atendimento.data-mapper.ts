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
}

import {
  at_atendimento_indi_camp_acess,
  at_atendimento_indicador,
  at_atendimento_usuario,
  at_cli_atend_prop,
} from '../entities/atendimento.entity';

export interface CreateAtendimentoInputDto {
  id_usuario: string;
  id_und_empresa: string;
  link_pdf: string;
  id_pessoa_demeter: string;
  id_pl_propriedade: string;
  id_at_anterior?: string;
  numero_relatorio?: string;
  temas_atendimento?: string[];
}

export interface CreateAtendimentoStorageDto {
  data_inicio_atendimento: string;
  data_fim_atendimento: string;
  data_atualizacao: string;
  id_at_status: number;
  ativo: boolean;
  id_at_acao: string;
  id_und_empresa: string;
  data_criacao: string;
  id_at_anterior?: string;
  link_pdf: string;
  sn_pendencia: number;
  at_atendimento_usuario: at_atendimento_usuario;
  at_cli_atend_prop: at_cli_atend_prop;
  at_atendimento_indicador: at_atendimento_indicador;
  at_atendimento_indi_camp_acess: at_atendimento_indi_camp_acess[];
}

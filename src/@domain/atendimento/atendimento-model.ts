export interface AtendimentoModel {
  id_at_atendimento: bigint;
  ativo: boolean;
  data_inicio_atendimento: Date;
  data_fim_atendimento?: Date | null;
  data_validacao?: Date | null;
  data_sei?: Date | null;
  link_pdf?: string | null;
  data_see?: Date | null;
  sn_pendencia?: number | null;
  sn_validado?: number | null;
  dt_export_ok?: Date | null;
  id_und_empresa?: string;
  fk_und_empresa?: string | null;
  data_criacao: Date;
  data_atualizacao?: Date;
  id_at_acao?: bigint;
  descricao?: string | null;
  id_at_status?: number;
  usuario_validacao?: bigint | null;
  qtd_alunos?: number | null;
  id_sincronismo?: string | null;
  orientacao_tecnica?: string | null;
  dt_update_record?: Date | null;
  geo_ponto?: any | null; // Unsupported("geometry")
  geo_ponto_texto?: string | null;
  sincroniza?: number | null;
  processamento?: number | null;
  login_usuario?: string | null;
  id_at_anterior?: bigint | null;
  auto_atendimento?: number | null;
  at_arquivo?: any[]; // at_arquivo[]
  usuario?: any | null; // Usuario?
  at_acao?: any; // at_acao
  ger_und_empresa?: any; // ger_und_empresa
  at_atendimento_indicador?: any[]; // at_atendimento_indicador[]
  at_atendimento_usuario?: any[]; // at_atendimento_usuario[]
  at_cli_atend_prop?: any[]; // at_cli_atend_prop[]
}

import { RelatorioModel } from 'src/@domain/relatorio/relatorio-model';

export interface RelatorioPresentationModel extends RelatorioModel {
  id_pessoa_demeter: string;
  nm_pessoa?: string;
  nr_cpf_cnpj?: string;
  municipio?: string;
  regional_sre?: string;
  nm_und_empresa?: string;
  id_regional_sre?: string;
  id_und_empresa?: string;
  id_reg_empresa?: string;
  fk_und_empresa: string;

  id_at_atendimento: string;
  ativo: boolean;
  data_criacao: string;
  data_inicio_atendimento: string;
  data_see: string | null;
  data_sei: string | null;
  data_validacao: string | null;
  dt_export_ok: string | null;
  sn_pendencia: number | null;
  sn_validacao: number | null;
  usuario: string;
}

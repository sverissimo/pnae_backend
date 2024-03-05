import { Propriedade } from 'src/modules/produtor/entities';
import { Perfil, PerfilModel } from '../perfil';

export class Produtor {
  id_pessoa_demeter: bigint;
  nm_pessoa: string | null;
  tp_sexo: string | null;
  nr_cpf_cnpj: string | null;
  dt_nascimento: Date | null;
  id_und_empresa: string | null;
  ds_email?: string | null;
  dt_update_record: Date;
  senha?: string | null;
  telefone?: string | null;
  status_account?: string | null;
  ds_apelido?: string | null;
  sn_ativo: number;
  dap?: string | null;
  dt_desativacao?: Date | null;
  nr_identidade?: string | null;
  nr_ins_produtor_rural?: string | null;
  nm_mae?: string | null;
  nm_nacionalidade?: string | null;
  ds_orgao_expedidor?: string | null;
  nm_pai?: string | null;
  sn_principal_provedor?: number | null;
  nm_profissao?: string | null;
  sn_pronaf?: number | null;
  tp_desativacao?: number | null;
  tp_pessoa?: string | null;
  perfis: Perfil[] | null;
  propriedades: Propriedade[] | null;
  fk_est_civil?: number | null;
  fk_uf_emissor?: number | null;
  id_pessoa?: string | null;
  id_sincronismo?: string | null;
  caf?: string | null;
  at_cli_atend_prop?: any[] | null;
  at_prf_see?: Perfil[] | null;
  pl_propriedade_ger_pessoa?: any[] | null;

  static getMunicipioFromPerfis(perfis: PerfilModel[]): string {
    if (!perfis[0]?.at_prf_see_propriedade[0]?.pl_propriedade?.municipio)
      return 'mun_nao_encontrado';
    return perfis[0].at_prf_see_propriedade[0].pl_propriedade.municipio.nm_municipio;
  }
}

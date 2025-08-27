export interface ProdutorFindManyOutputDTO {
  id_pessoa_demeter: string;
  nm_pessoa: string;
  nr_cpf_cnpj: string;
  id_und_empresa: string;
  id_reg_empresa?: string;
  nm_und_empresa?: string;
  municipio: string;
  regional_sre?: string;
}

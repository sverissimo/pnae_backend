export interface ProdutoresFromGraphQLDto {
  produtores: ProdutorEntry[];
}

export interface ProdutorEntry {
  id_pessoa_demeter: string;
  nm_pessoa: string;
  nr_cpf_cnpj: string;
  id_und_empresa: string;
  perfis: PerfilEntry[];
}

export interface PerfilEntry {
  at_prf_see_propriedade: PropriedadeEntry[];
}

interface PropriedadeEntry {
  pl_propriedade: {
    municipio: { nm_municipio: string };
    ger_und_empresa: GerUndEmpresa;
    regional_sre?: string;
  };
}

export interface GerUndEmpresa {
  id_und_empresa: string;
  fk_und_empresa: string;
  nm_und_empresa: string;
  ger_und_empresa: ChildGerUndEmpresa;
}

export interface ChildGerUndEmpresa {
  id_und_empresa: string;
  nm_und_empresa: string;
}

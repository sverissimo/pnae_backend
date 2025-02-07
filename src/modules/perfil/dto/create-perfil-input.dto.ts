export interface PerfilPresentationInputDTO {
  participa_organizacao: string;
  grau_interesse_pnae: string;
  atividade: string;
  gruposNaturaOptions: GrupoNaturaOption[];
  gruposIndustrialOptions: GrupoNaturaOption[];
  local_comercializacao: string[];
  valor_total_obtido_pnae: string;
  valor_total_obtido_outros: string;
  nivel_tecnologico_cultivo: string[];
  sistema_producao: string[];
  controla_custos_producao: string;
  realiza_escalonamento_producao: string;
  procedimento_pos_colheita: string[];
  dificuldade_fornecimento: string[];
  informacoes_adicionais: string;
  tipo_perfil: string;
  id_cliente: string;
  id_tecnico: string;
  id_propriedade: string;
  id_contrato: number;
}

export interface GrupoNaturaOption {
  id_grupo: string;
  id_grupo_legado: number;
  tipo: number;
  nm_grupo: string;
  dados_producao_estratificados_por_produto: boolean;
  at_prf_see_produto: Produto[];
  area_utilizada: string;
  producao_aproximada_ultimo_ano_total: string;
  producao_aproximada_ultimo_ano_pnae: string;
}

export interface Produto {
  id_produto: string;
  id_legado: number;
  nm_produto: string;
  tipo: number;
  id_grupo_legado: number;
  sg_und_medida: string;
}

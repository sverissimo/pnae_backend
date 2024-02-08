export type CreateGrupoProdutosInputDTO = {
  id?: string;
  area_utilizada?: number;
  producao_aproximada_ultimo_ano_pnae?: string;
  producao_aproximada_ultimo_ano_total?: string;
  at_prf_see_produto: CreateProdutosInputDTO[];
};

export type CreateProdutosInputDTO = {
  id_produto: string;
  area_utilizada?: number;
  producao_aproximada_ultimo_ano_pnae?: string;
  producao_aproximada_ultimo_ano_total?: string;
};

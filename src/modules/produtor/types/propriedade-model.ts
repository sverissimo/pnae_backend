import { Produtor } from '../entities';

type Municipio = {
  nm_municipio: string;
};

export type PropriedadeModel = {
  id_pl_propriedade: string;
  nome_propriedade: string;
  geo_ponto_texto?: string;
  area_total?: string;
  id_municipio?: number;
  municipio: Municipio;
  at_prf_see_propriedade: { producao_dedicada_pnae: boolean; atividade: string };
  produtor?: Produtor;
};

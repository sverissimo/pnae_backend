import { Produtor } from './produtor.entity';

export class Propriedade {
  id: string;
  produtorId: string;
  nomePropriedade: string;
  coordenadas?: string;
  area?: string;
  municipioId?: number;
  produtor?: Produtor;
}

export class PropriedadeDTO {
  id_pl_propriedade: string;
  nome_propriedade: string;
  area_total: number;
  municipio: { nm_municipio: string };
  geo_ponto_texto: string;
  id_municipio: string;
  atividade_principal: string;
  at_prf_see_propriedade: { producao_dedicada_pnae: boolean; atividade: string };
}

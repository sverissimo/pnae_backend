import { PerfilModel } from '../entities';
import { DadosProducaoDTO } from './dados-producao';

export type PerfilDTO = Omit<
  PerfilModel,
  'dados_producao_agro_industria' | 'dados_producao_in_natura'
> & {
  dados_producao_in_natura: DadosProducaoDTO;
  dados_producao_agro_industria: DadosProducaoDTO;
  ativo?: boolean;
  id_contrato?: number;
};

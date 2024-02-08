import { PerfilModel } from '../../../@domain/perfil';
import { DadosProducaoDTO } from './dados-producao';

export type PerfilDTO = Omit<
  PerfilModel,
  'dados_producao_agro_industria' | 'dados_producao_in_natura' | 'at_prf_see_propriedade'
> & {
  at_prf_see_propriedade: {
    atividade: 'ATIVIDADE_PRIMARIA' | 'ATIVIDADE_SECUNDARIA' | 'AMBAS';
    producao_dedicada_pnae: boolean;
  };
  dados_producao_in_natura: DadosProducaoDTO;
  dados_producao_agro_industria: DadosProducaoDTO;
};

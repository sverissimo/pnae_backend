import { DadosProducaoModel } from 'src/modules/perfil/types';
import { CreateGrupoProdutosInputDTO } from './create-produtos.dto';

export type CreateDadosProducaoInputDTO = Omit<DadosProducaoModel, 'at_prf_see_grupos_produtos'> & {
  at_prf_see_grupos_produtos: CreateGrupoProdutosInputDTO[];
};

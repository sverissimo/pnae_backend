import { PerfilModel, at_prf_see_propriedade } from '..';
import { CreateDadosProducaoInputDTO } from './create-dados-producao-dto';

export type CreatePerfilInputDto = Omit<
  PerfilModel,
  | 'id'
  | 'id_dados_producao_in_natura'
  | 'id_dados_producao_agro_industria'
  | 'id_at_prf_see_propriedade'
  | 'at_prf_see_propriedade'
  | 'dados_producao_agro_industria'
  | 'dados_producao_in_natura'
  | 'usuario'
> & {
  id_tecnico: string;
  id_propriedade: string;
  at_prf_see_propriedade: at_prf_see_propriedade;
  dados_producao_agro_industria: CreateDadosProducaoInputDTO;
  dados_producao_in_natura: CreateDadosProducaoInputDTO;
};

export type CreatePerfilOutputDto = CreatePerfilInputDto & {
  ativo: boolean;
};

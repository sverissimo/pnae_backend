import { PerfilModel } from '..';
import { CreateDadosProducaoInputDTO } from './create-dados-producao-dto';

export type CreatePerfilInputDto = Omit<
  PerfilModel,
  'usuario' | 'dados_producao_agro_industria' | 'dados_producao_in_natura'
> & {
  id_tecnico: string;
  id_propriedade: string;
  dados_producao_agro_industria: CreateDadosProducaoInputDTO;
  dados_producao_in_natura: CreateDadosProducaoInputDTO;
};

export type CreatePerfilOutputDto = CreatePerfilInputDto & {
  ativo: boolean;
};

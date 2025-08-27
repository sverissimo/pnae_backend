import { ProdutorEntry } from '../types/produtores.from-graphql-dto';
import { ProdutorFindManyOutputDTO } from '../types/produtores.output-dto';

export class ProdutorDataMapper {
  static ProdutoresFromGraphQLtoOutputDTO(
    produtor: ProdutorEntry,
  ): ProdutorFindManyOutputDTO {
    const {
      id_pessoa_demeter,
      nm_pessoa,
      nr_cpf_cnpj,
      id_und_empresa,
      perfis,
    } = produtor;

    const { pl_propriedade } = perfis[0]?.at_prf_see_propriedade[0] || {};
    const { regional_sre } = pl_propriedade || {};

    const municipio =
      pl_propriedade?.municipio?.nm_municipio ?? 'mun_nao_encontrado';

    const { id_und_empresa: id_reg_empresa, nm_und_empresa } =
      pl_propriedade?.ger_und_empresa.ger_und_empresa || {};

    return {
      id_pessoa_demeter,
      nm_pessoa,
      nr_cpf_cnpj,
      municipio,
      id_und_empresa,
      id_reg_empresa,
      nm_und_empresa,
      regional_sre,
    };
  }
}

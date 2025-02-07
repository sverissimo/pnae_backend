import { PerfilModel } from './perfil.model';
import {
  formattedValues,
  perfilFieldLabels,
  producaoIndustrialLabels,
  producaoNaturaLabels,
} from '../../modules/perfil/constants';
import { Produto, at_prf_see_propriedade } from '.';
import { PerfilDTO } from '../../modules/perfil/types';
import {
  CreatePerfilInputDto,
  CreatePerfilOutputDto,
} from './dto/create-perfil.dto';
import { CreateDadosProducaoInputDTO } from './dto/create-dados-producao-dto';

export class Perfil {
  constructor(private perfil?: PerfilModel | CreatePerfilInputDto) {}

  inputDTOToOutputDTO(): CreatePerfilOutputDto {
    const p = this.getOutputDTOValues(this.perfil as CreatePerfilInputDto);
    const {
      dados_producao_agro_industria: prodInd,
      dados_producao_in_natura: prodNatura,
    } = p;

    this.parseValues(prodNatura);
    this.parseValues(prodInd);

    return {
      ...p,
      ativo: true,
    };
  }

  toDTO(): PerfilDTO {
    if (!this.perfil) return;
    const produto = new Produto();
    const {
      dados_producao_agro_industria,
      dados_producao_in_natura,
      at_prf_see_propriedade,
      ...rest
    } = this.perfil as PerfilModel;

    const atividade = this.atividadesArrayToValue(at_prf_see_propriedade);

    const gruposProdutosNatura =
      dados_producao_in_natura?.at_prf_see_grupos_produtos
        ? dados_producao_in_natura.at_prf_see_grupos_produtos.map((group) =>
            produto.productGroupToDTO(group),
          )
        : null;

    const gruposProdutosIndustriais =
      dados_producao_agro_industria?.at_prf_see_grupos_produtos
        ? dados_producao_agro_industria.at_prf_see_grupos_produtos.map(
            (group) => produto.productGroupToDTO(group),
          )
        : null;

    const perfilDTO = {
      ...rest,
      at_prf_see_propriedade: { atividade },
      dados_producao_in_natura: {
        ...dados_producao_in_natura,
        at_prf_see_grupos_produtos: gruposProdutosNatura,
      },
      dados_producao_agro_industria: {
        ...dados_producao_agro_industria,
        at_prf_see_grupos_produtos: gruposProdutosIndustriais,
      },
    };

    return this.getDTOValues(perfilDTO as PerfilDTO);
  }

  toPDFModel(perfil: PerfilModel & { nome_propriedade: string }) {
    const {
      at_prf_see_propriedade,
      dados_producao_in_natura,
      dados_producao_agro_industria,
      ...rest
    } = perfil;

    const atividade = this.atividadesArrayToValue(at_prf_see_propriedade);

    const perfilData = perfilFieldLabels.map(({ field, label }) => ({
      label,
      value:
        field === 'atividade'
          ? this.formatToDTO(atividade)
          : this.formatToDTO(rest[field]),
    }));

    const perfilPDFModel = { perfilData };

    const producaoNatura =
      atividade === 'ATIVIDADE_PRIMARIA' || atividade === 'AMBAS'
        ? producaoNaturaLabels.map(({ field, label }) => {
            const value =
              perfil[field] === null || perfil[field] === undefined
                ? perfil.dados_producao_in_natura[field]
                : perfil[field];
            return {
              label,
              value: this.formatToDTO(value),
            };
          })
        : [];

    const producaoIndustrial =
      atividade === 'ATIVIDADE_SECUNDARIA' || atividade === 'AMBAS'
        ? producaoIndustrialLabels.map(({ field, label }) => {
            const value =
              perfil[field] === null || perfil[field] === undefined
                ? perfil.dados_producao_agro_industria[field]
                : perfil[field];
            return {
              label,
              value: this.formatToDTO(value),
            };
          })
        : [];

    if (producaoNatura.length > 0) {
      Object.assign(perfilPDFModel, { producaoNatura });
    }
    if (producaoIndustrial.length > 0) {
      Object.assign(perfilPDFModel, { producaoIndustrial });
    }

    return perfilPDFModel;
  }

  private parseValues(obj: CreateDadosProducaoInputDTO) {
    const produto = new Produto();

    if (obj && obj.at_prf_see_grupos_produtos) {
      obj.at_prf_see_grupos_produtos.forEach(
        produto.productGroupInputToOutputDTO.bind(produto),
      );
    }
  }

  private getDTOValues(perfilDTO: PerfilDTO): PerfilDTO {
    const result = {} as PerfilDTO;
    for (const key in perfilDTO) {
      let value = perfilDTO[key];
      if (value === null || value === undefined) continue;

      if (typeof value === 'object' && !Array.isArray(value)) {
        value = this.getDTOValues(value);
      }
      result[key] = this.formatToDTO(value);
    }
    return result;
  }

  private formatToDTO(value) {
    if (typeof value === 'string' || typeof value === 'boolean') {
      const values = formattedValues.find((v) => v[0] === value);
      return values ? values[1] : value;
    } else {
      return value;
    }
  }

  private getOutputDTOValues(perfilDTO: CreatePerfilInputDto) {
    const result = {} as CreatePerfilOutputDto;

    for (const key in perfilDTO) {
      let value = perfilDTO[key];
      if (value === null || value === undefined) continue;

      if (Array.isArray(value)) {
        value = value.map((v) => this.getOutputDTOValues(v));
      }

      if (typeof value === 'object' && !Array.isArray(value)) {
        value = this.getOutputDTOValues(value);
      }

      if (typeof value === 'string') {
        const values = formattedValues.find((v) => v[1] === value);
        result[key] = values ? values[0] : value;
      } else {
        result[key] = value;
      }
    }
    return result;
  }

  private atividadesArrayToValue(
    at_prf_see_propriedades: at_prf_see_propriedade[],
  ) {
    const atividade = at_prf_see_propriedades.reduce((acc, curr) => {
      if (acc === 'AMBAS') return acc;
      if (
        acc === 'ATIVIDADE_PRIMARIA' &&
        curr.atividade === 'ATIVIDADE_SECUNDARIA'
      )
        return 'AMBAS';
      if (
        acc === 'ATIVIDADE_SECUNDARIA' &&
        curr.atividade === 'ATIVIDADE_PRIMARIA'
      )
        return 'AMBAS';

      return curr.atividade;
    }, at_prf_see_propriedades[0].atividade);

    return atividade as 'ATIVIDADE_PRIMARIA' | 'ATIVIDADE_SECUNDARIA' | 'AMBAS';
  }
}

import { parseValue } from 'src/utils/parseFormValues';
import { PerfilModel } from './perfil.model';
import {
  formattedValues,
  perfilFieldLabels,
  producaoIndustrialLabels,
  producaoNaturaLabels,
} from '../constants';
import { Produto } from '.';
import { PerfilDTO } from '../types';

export class Perfil {
  constructor(private perfil?: PerfilModel) {}

  toModel() {
    const p = this.getModelValues(this.perfil);
    return p;
  }

  toDTO(): PerfilDTO {
    if (!this.perfil) return;
    const produto = new Produto();
    const { dados_producao_agro_industria, dados_producao_in_natura, ...rest } = this.perfil;

    const gruposProdutosNatura = dados_producao_in_natura?.at_prf_see_grupos_produtos
      ? dados_producao_in_natura.at_prf_see_grupos_produtos.map((group) =>
          produto.productGroupToDTO(group),
        )
      : null;

    const gruposProdutosIndustriais = dados_producao_agro_industria?.at_prf_see_grupos_produtos
      ? dados_producao_agro_industria.at_prf_see_grupos_produtos.map((group) =>
          produto.productGroupToDTO(group),
        )
      : null;

    const perfilDTO = {
      ...rest,
      dados_producao_in_natura: {
        ...dados_producao_in_natura,
        at_prf_see_grupos_produtos: gruposProdutosNatura,
      },
      dados_producao_agro_industria: {
        ...dados_producao_agro_industria,
        at_prf_see_grupos_produtos: gruposProdutosIndustriais,
      },
    };

    return this.getDTOValues(perfilDTO);
  }

  toPDFModel(perfil: PerfilModel & { nome_propriedade: string }) {
    const {
      at_prf_see_propriedade,
      dados_producao_in_natura,
      dados_producao_agro_industria,
      ...rest
    } = perfil;
    const { atividade } = at_prf_see_propriedade;

    const perfilData = perfilFieldLabels.map(({ field, label }) => ({
      label,
      value: field === 'atividade' ? this.formatToDTO(atividade) : this.formatToDTO(rest[field]),
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

  private getModelValues(perfilDTO: PerfilModel) {
    const result = {} as PerfilDTO;

    for (const key in perfilDTO) {
      let value = perfilDTO[key];
      if (value === null || value === undefined) continue;

      if (Array.isArray(value)) {
        value = value.map((v) => this.getModelValues(v));
      }

      if (typeof value === 'object' && !Array.isArray(value)) {
        value = this.getModelValues(value);
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
}

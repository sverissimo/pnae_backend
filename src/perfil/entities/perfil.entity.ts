import { parseValue } from 'src/utils/parseFormValues';
import { PerfilModel } from './perfil.model';
import { perfilFieldLabels, producaoIndustrialLabels, producaoNaturaLabels } from '../constants';

export class Perfil {
  toPDFModel(perfil: PerfilModel) {
    const {
      at_prf_see_propriedade,
      dados_producao_in_natura,
      dados_producao_agro_industria,
      ...rest
    } = perfil;
    const { atividade } = at_prf_see_propriedade;

    const perfilData = perfilFieldLabels.map(({ field, label }) => ({
      label,
      value: field === 'atividade' ? atividade.replace('_', ' ') : parseValue(rest[field]),
    }));
    console.log('🚀 ~ file: perfil.entity.ts:19 ~ Perfil ~ perfilData ~ perfilData:', perfilData);

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
              value: parseValue(value).replace('NAO_POSSUI', 'Não possui').replaceAll('_', ' '),
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
              value: parseValue(value).replace('NAO_POSSUI', 'Não possui').replaceAll('_', ' '),
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
}

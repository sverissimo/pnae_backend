import { parseValue } from 'src/utils/parseFormValues';
import { PerfilModel } from './perfil.model';
import { perfilFieldLabels, producaoIndustrialLabels, producaoNaturaLabels } from '../constants';

export class Perfil {
  toPDFModel(perfil: PerfilModel) {
    const perfilData = perfilFieldLabels.map(({ field, label }) => {
      if (field === 'atividade') {
        return {
          label,
          value: perfil.at_prf_see_propriedade.atividade,
        };
      }
      return {
        label,
        value: parseValue(perfil[field]),
      };
    });

    const { atividade } = perfil.at_prf_see_propriedade;
    const perfilPDFModel = { perfilData };

    const producaoNatura =
      atividade === 'ATIVIDADE_PRIMARIA' || atividade === 'AMBAS'
        ? producaoNaturaLabels.map(({ field, label }) => ({
            label,
            value: parseValue(perfil[field]),
          }))
        : [];

    const producaoIndustrial =
      atividade === 'ATIVIDADE_SECUNDARIA' || atividade === 'AMBAS'
        ? producaoIndustrialLabels.map(({ field, label }) => ({
            label,
            value: parseValue(perfil[field]),
          }))
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

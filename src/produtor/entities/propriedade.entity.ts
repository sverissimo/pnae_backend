import { PropriedadeDTO } from '../dto';
import { PropriedadeModel } from '../types';

export class Propriedade {
  constructor(private propriedade: PropriedadeModel) {}

  toDTO(): PropriedadeDTO {
    const { at_prf_see_propriedade, ...rest } = this.propriedade;
    const municipio = this.propriedade.municipio?.nm_municipio;
    const { atividade, producao_dedicada_pnae } = at_prf_see_propriedade;
    const propriedadeDTO: PropriedadeDTO = {
      ...rest,
      municipio,
      atividade,
      producao_dedicada_pnae,
    };
    return propriedadeDTO;
  }
}

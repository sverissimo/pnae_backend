import { RelatorioModel } from 'src/@domain/relatorio/relatorio-model';

export interface UpdateRelatorioDto extends Partial<RelatorioModel> {
  temas_atendimento?: string;
}

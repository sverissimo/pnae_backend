import { Propriedade } from './propriedade.entity';

export class Produtor {
  id: number;
  nomeProdutor: string;
  cpfProdutor: string;
  tipoPessoa: string;
  sexo: string;
  dataNascimento: Date;
  situacao: number;
  caf?: string;
  dap?: string;
  municipioId?: number;
  propriedades: Propriedade[];
}

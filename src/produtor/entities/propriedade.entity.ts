import { Produtor } from './produtor.entity';

export class Propriedade {
  id: string;
  produtorId: string;
  nomePropriedade: string;
  coordenadas?: string;
  area?: string;
  municipioId?: number;
  produtor?: Produtor;
}

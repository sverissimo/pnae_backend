import { Produtor } from 'src/@domain/produtor/produtor';
import { Usuario } from 'src/modules/usuario/entity/usuario-model';

export type RelatorioPDF = {
  id: string;
  produtorId: string | BigInt;
  tecnicoId: string | BigInt;
  contratoId: number;
  nomeProdutor?: string;
  nomeTecnico: string;
  matricula: string;
  numeroRelatorio: number;
  assunto: string;
  orientacao: string;
  produtor?: Partial<Produtor>;
  pictureURI?: string;
  assinaturaURI?: string;
  municipio?: string;
  outrosExtensionistas?: Usuario[];
  data?: string | Date;
  createdAt: any;
  updatedAt?: any;
} | null;

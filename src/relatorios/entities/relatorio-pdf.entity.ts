import { Usuario } from '@prisma/client';
import { Produtor } from 'src/produtor/entities/produtor.entity';

export type RelatorioPDF = {
  id: string;
  produtorId: string | BigInt;
  tecnicoId: string | BigInt;
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

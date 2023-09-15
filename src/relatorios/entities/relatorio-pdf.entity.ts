import { Usuario } from '@prisma/client';

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
  produtor?: any;
  pictureURI?: string;
  assinaturaURI?: string;
  outrosExtensionistas?: Usuario[];
  data?: string | Date;
  createdAt: any;
  updatedAt?: any;
} | null;

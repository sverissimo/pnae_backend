export type RelatorioPDF = {
  id?: number;
  produtorId?: string | BigInt;
  tecnicoId?: string | BigInt;
  nomeProdutor?: string;
  nomeTecnico?: string;
  matricula?: string;
  numeroRelatorio?: number;
  assunto?: string;
  orientacao?: string;
  produtor?: any;
  pictureURI?: string;
  assinaturaURI?: string;
  data?: string | Date;
  createdAt?: any;
  updatedAt?: any;
} | null;

export type RelatorioPDF = {
  id?: number;
  produtorId?: string | BigInt;
  tecnicoId?: string | BigInt;
  nomeTecnico?: string;
  matricula?: string;
  numeroRelatorio?: number;
  assunto?: string;
  orientacao?: string;
  //produtor?: Produtor;
  pictureURI?: string;
  assinaturaURI?: string;
  createdAt?: any;
  updatedAt?: any;
} | null;

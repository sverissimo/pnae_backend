export type Relatorio = {
  id?: number;
  produtorId?: string | BigInt;
  tecnicoId?: string | BigInt;
  nomeTecnico?: string;
  numeroRelatorio?: number;
  assunto?: string;
  orientacao?: string;
  //produtor?: Produtor;
  pictureURI?: string;
  assinaturaURI?: string;
  createdAt?: any;
  updatedAt?: any;
};

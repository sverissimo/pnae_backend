export type Relatorio = {
  id?: number;
  produtorId?: string;
  tecnicoId?: string;
  nome_tecnico?: string;
  numeroRelatorio?: number;
  assunto?: string;
  orientacao?: string;
  //produtor?: Produtor;
  pictureURI?: string;
  assinaturaURI?: string;
  createdAt?: any;
  updatedAt?: any;
} | null;

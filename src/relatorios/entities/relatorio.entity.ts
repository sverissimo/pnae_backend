export type Relatorio = {
  id: number;
  produtorId: string;
  tecnicoId: string;
  numeroRelatorio: number;
  assunto: string;
  orientacao: string;
  pictureURI: string;
  assinaturaURI: string;
  outroExtensionista?: string;
  createdAt: any;
  updatedAt?: any;
};

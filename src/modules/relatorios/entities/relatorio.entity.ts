export type Relatorio = {
  id: number;
  produtorId: string;
  tecnicoId: string;
  contratoId: number;
  numeroRelatorio: number;
  assunto: string;
  orientacao: string;
  pictureURI: string;
  assinaturaURI: string;
  outroExtensionista?: string;
  createdAt: any;
  updatedAt?: any;
};

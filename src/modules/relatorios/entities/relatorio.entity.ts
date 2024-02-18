export type Relatorio = {
  id: string;
  produtorId: bigint;
  tecnicoId: bigint;
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

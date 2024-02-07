export type RelatorioModel = {
  id: string;
  produtorId: string;
  tecnicoId: string;
  contratoId: number;
  numeroRelatorio: number;
  assunto: string;
  orientacao: string;
  pictureURI: string;
  assinaturaURI: string;
  outroExtensionista?: string;
  coordenadas?: string;
  readOnly: boolean;
  createdAt: string;
  updatedAt?: string;
};

export class RelatorioDto {
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
  readOnly: boolean;
  coordenadas?: string;
  createdAt: Date;
  updatedAt?: Date;
}

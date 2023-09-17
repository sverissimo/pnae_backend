export class CreateRelatorioDto {
  id: string;
  produtorId: bigint;
  tecnicoId: bigint;
  numeroRelatorio: number;
  assunto: string;
  orientacao: string;
  pictureURI?: string;
  assinaturaURI?: string;
  outroExtensionista?: string;
  readonly?: boolean;
  coordenadas?: string;
}

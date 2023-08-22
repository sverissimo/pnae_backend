export class CreateRelatorioDto {
  produtorId: bigint;
  tecnicoId: bigint;
  numeroRelatorio: number;
  assunto: string;
  orientacao: string;
  pictureURI: string;
  assinaturaURI: string;
}

export class CreateRelatorioDto {
  id: string;
  produtorId: bigint | string;
  tecnicoId: bigint;
  numeroRelatorio: number;
  assunto: string;
  orientacao: string;
  assinaturaFileName?: string;
  fotoFileName?: string;
}

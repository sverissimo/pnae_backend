import { RelatorioModel } from 'src/@domain/relatorio/relatorio-model';

export interface CreateRelatorioStream {
  (relatorioId: string, relatorio: RelatorioModel): Promise<{
    filename: string;
    pdfStream: NodeJS.ReadableStream;
  }>;
}

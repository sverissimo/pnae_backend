export type FileType = 'foto' | 'relatorio';

export interface GetArquivosQueryDTO {
  atendimentoId: string;
  fileType: FileType;
}

// Row shape of the gateway's `GET /api/getArquivosAtendimento` (all active files of an
// atendimento, lowest idArquivo first); `arquivo` is the raw stored binary payload.
export interface ArquivoAtendimentoDTO {
  idArquivo: string;
  tipoArquivo: string | null;
  arquivo: string | null;
}

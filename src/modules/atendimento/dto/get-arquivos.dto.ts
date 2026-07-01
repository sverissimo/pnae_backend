export type FileType = 'foto' | 'relatorio';

export interface GetArquivosQueryDTO {
  atendimentoId: string;
  fileType: FileType;
}

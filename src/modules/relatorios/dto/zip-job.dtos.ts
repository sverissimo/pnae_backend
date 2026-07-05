import { RelatorioModel } from 'src/@domain/relatorio/relatorio-model';
import { AtendimentoComRelatorioDemeterDTO } from 'src/modules/atendimento/dto/atendimento-com-relatorio-demeter.dto';

export type JobStatus =
  | 'active'
  | 'processing'
  | 'waiting'
  | 'delayed'
  | 'empty'
  | 'completed'
  | 'failed';

export interface JobStatusDTO {
  jobId: string;
  status: JobStatus;
  downloadUrl?: string;
  createdAt?: string; // ISO from BullMQ job.timestamp
  errorMessage?: string;
  progress?: number; // 0..100 from BullMQ job.getProgress()
}

export interface ZipFileMetadata {
  filename: string;
  createdAt: string; // ISO date string
  mode: 'date-range' | 'atendimento-ids';
  fromDate?: string; // ISO date string, date-range ZIPs only
  toDate?: string; // ISO date string, date-range ZIPs only
  downloadUrl: string;
}

export const MAX_ZIP_ATENDIMENTO_IDS = 1000;

// Redis hash: field = final ZIP filename, value = JSON array of the atendimento ids that
// actually produced a PDF. No TTL — entries outlive the last-5-files disk cleanup.
export const ZIP_ATENDIMENTOS_INCLUIDOS_KEY = 'zip:atendimentos-incluidos';

// Producer (RelatorioExportService) and consumer (ZipWorkerService) must always agree on this
// name. Dev and hmg share one Redis instance, so ZIP_QUEUE_NAME must be set per environment
// there — otherwise another environment's worker steals the job (see .env.example).
export const ZIP_QUEUE_NAME = process.env.ZIP_QUEUE_NAME || 'zip-generation';

export interface CreateZipDto {
  userId: string; // must be in allowed list from .env
  atendimentoIds: string[]; // Demeter at_atendimento ids, numeric strings
}

export type ZipRelatorioItem =
  | {
      source: 'pnae';
      atendimentoId: string;
      regional: string;
      municipio: string;
      relatorio: RelatorioModel;
    }
  | {
      source: 'demeter';
      atendimentoId: string;
      regional: string;
      municipio: string;
      demeter: AtendimentoComRelatorioDemeterDTO;
    };

export type MunicipioZipBucket = {
  municipio: string;
  items: ZipRelatorioItem[];
};

export type RegionalZipGroup = {
  regional: string;
  municipios: MunicipioZipBucket[];
};

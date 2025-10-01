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
  fromDate?: string;
  toDate?: string;
  errorMessage?: string;
  progress?: number; // 0..100 from BullMQ job.getProgress()
}

export interface ZipFileMetadata {
  filename: string;
  createdAt: string; // ISO date string
  fromDate: string; // ISO date string
  toDate: string; // ISO date string
  downloadUrl: string;
}

// dto/create-zip.dto.ts
export interface CreateZipDto {
  from: string; // ISO start date
  to: string; // ISO end date
  userId: string; // must be in allowed list from .env
}

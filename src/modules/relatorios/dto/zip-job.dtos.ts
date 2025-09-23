// dto/job-status.dto.ts
export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface JobStatusDTO {
  jobId: string;
  status: JobStatus;
  downloadUrl?: string;
  errorMessage?: string;
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

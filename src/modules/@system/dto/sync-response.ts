import { RelatorioSyncInfo } from './check-for-updates-input.dto';

export type SyncInfoResponse<T> = {
  upToDateIds: string[];
  outdatedOnServer: Partial<RelatorioSyncInfo>[];
  missingIdsOnServer: string[];
  outdatedOnClient: T[];
  missingOnClient: T[];
};

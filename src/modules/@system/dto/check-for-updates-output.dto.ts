export type CheckForUpdatesOutputDto<T> = {
  upToDateIds: string[];
  outdatedOnServer: Partial<T>[];
  missingIdsOnServer: string[];
  outdatedOnClient: T[];
  missingOnClient: T[];
};

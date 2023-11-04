export type CheckForUpdatesResult<T> = {
  upToDateIds: string[];
  outdatedIdsOnServer: string[];
  missingIdsOnServer: string[];
  outdatedOnClient: T[];
  missingOnClient: T[];
};

export type RelatorioSyncInfo = {
  id: string;
  assinaturaURI?: string;
  pictureURI?: string;
  updatedAt: string;
};

export type CheckForUpdatesInputDto = {
  produtorIds: string[];
  relatoriosSyncInfo: RelatorioSyncInfo[];
};

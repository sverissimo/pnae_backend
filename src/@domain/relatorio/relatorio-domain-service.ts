import { RelatorioSyncInfo } from 'src/modules/@sync/dto/check-for-updates-input.dto';
import { RelatorioModel } from './relatorio-model';
import { SyncInfoResponse } from 'src/modules/@sync/dto/sync-response';

export class RelatorioDomainService {
  static getSyncInfo(
    relatoriosFromClient: RelatorioSyncInfo[],
    existingRelatorios: RelatorioModel[],
  ) {
    const syncInfo: SyncInfoResponse<RelatorioModel> = {
      upToDateIds: [],
      outdatedOnServer: [],
      missingIdsOnServer: [],
      outdatedOnClient: [],
      missingOnClient: [],
    };

    const clientIds = new Set(relatoriosFromClient.map((r) => r.id));
    const serverIds = new Set(existingRelatorios.map((r) => r.id));

    syncInfo.missingOnClient = existingRelatorios.filter((r) => !clientIds.has(r.id));
    syncInfo.missingIdsOnServer = relatoriosFromClient
      .filter((r) => !serverIds.has(r.id))
      .map((r) => r.id);

    for (const serverRelatorio of existingRelatorios) {
      const clientRelatorio = relatoriosFromClient.find((r) => r.id === serverRelatorio.id);

      if (!clientRelatorio) {
        continue;
      }

      const clientUpdatedAt = clientRelatorio.updatedAt && new Date(clientRelatorio.updatedAt);
      const serverUpdatedAt = serverRelatorio.updatedAt && new Date(serverRelatorio.updatedAt);

      const isUpToDate =
        (!clientUpdatedAt && !serverUpdatedAt) ||
        clientUpdatedAt?.getTime() === serverUpdatedAt?.getTime();

      if (isUpToDate) {
        syncInfo.upToDateIds.push(clientRelatorio.id);
        continue;
      }

      if (clientUpdatedAt < serverUpdatedAt || (!clientUpdatedAt && serverUpdatedAt)) {
        syncInfo.outdatedOnClient.push(serverRelatorio);
        continue;
      }

      if (clientUpdatedAt > serverUpdatedAt || (clientUpdatedAt && !serverUpdatedAt)) {
        const update = { id: clientRelatorio.id } as Record<string, string | boolean>;
        const outDatedURIs = this.checkOutdatedURIs(clientRelatorio, serverRelatorio);

        Object.assign(update, outDatedURIs);

        syncInfo.outdatedOnServer.push(update);
        continue;
      }

      syncInfo.upToDateIds.push(clientRelatorio.id);
    }

    console.log('🚀 - SyncService - updateRelatoriosData - syncInfo:', syncInfo);
    return syncInfo;
  }

  private static checkOutdatedURIs(
    clientRelatorio: RelatorioSyncInfo,
    serverRelatorio: RelatorioModel,
  ) {
    const outDatedURIs: Record<string, string | boolean> = {};

    console.log('🚀 - RelatorioDomainService - clientRelatorio:', {
      clientRelatorioAssinatura: clientRelatorio.assinaturaURI,
      clientRelatorioPicture: clientRelatorio.pictureURI,
      serverRelatorioAssinatura: serverRelatorio.assinaturaURI,
      serverRelatorioPicture: serverRelatorio.pictureURI,
    });
    if (clientRelatorio.assinaturaURI !== serverRelatorio.assinaturaURI) {
      outDatedURIs.assinaturaURI = true;
    }

    if (clientRelatorio.pictureURI !== serverRelatorio.pictureURI) {
      outDatedURIs.pictureURI = true;
    }

    return outDatedURIs;
  }
}

import { Injectable } from '@nestjs/common';
import {
  CheckForUpdatesInputDto,
  RelatorioSyncInfo,
} from './dto/check-for-updates-input.dto';
import { RelatorioService } from '../relatorios/relatorios.service';
import { RelatorioDomainService } from 'src/@domain/relatorio/relatorio-domain-service';
import { ProdutorSyncInput } from './dto/produtor-sync-input.dto';
import { ProdutorService } from '../produtor/produtor.service';
import { CheckForUpdatesOutputDto } from './dto/check-for-updates-output.dto';
import { compareClientAndServerDates } from './utils/compareClientAndServerDates';
import { ProdutorDTO } from '../produtor/dto';
import { FileService } from 'src/common/files/file.service';
import { RelatorioModel } from 'src/@domain/relatorio/relatorio-model';

@Injectable()
export class SyncService {
  constructor(
    private readonly relatorioService: RelatorioService,
    private produtorService: ProdutorService,
    private fileService: FileService,
  ) {}

  async getProdutorSyncInfo(
    produtorSyncInput: ProdutorSyncInput,
  ): Promise<Partial<CheckForUpdatesOutputDto<ProdutorDTO>>> {
    const { produtorId, updatedAt } = produtorSyncInput;

    const produtor = await this.produtorService
      .findOne(produtorId)
      .catch((err) => {
        throw err;
      });

    if (!produtor) {
      return { missingIdsOnServer: [produtorId] };
    }

    if (!updatedAt && !produtor.dt_update_record) {
      return { upToDateIds: [produtorId] };
    }

    const clientUpdatedAt = updatedAt && new Date(updatedAt);
    const serverUpdatedAt =
      produtor.dt_update_record && new Date(produtor.dt_update_record);

    const updateStatus = compareClientAndServerDates(
      clientUpdatedAt,
      serverUpdatedAt,
    );
    const response =
      updateStatus === 'outdatedOnClient'
        ? { outdatedOnClient: [produtor] }
        : updateStatus === 'outdatedOnServer'
          ? { outdatedOnServer: [{ id_pessoa_demeter: BigInt(produtorId) }] }
          : { upToDateIds: [produtorId] };

    return response;
  }

  async getRelatorioSyncData(updatesInput: CheckForUpdatesInputDto) {
    const { produtorIds, relatoriosSyncInfo: relatoriosFromClient } =
      updatesInput;

    const ids = relatoriosFromClient.map((r) => r.id);
    const existingRelatorios = await this.relatorioService.findMany({
      ids,
      produtorIds,
    });

    // Domain diff: logical freshness & URI patch classification (no filesystem awareness here).
    const updateInfoOutput = RelatorioDomainService.getSyncInfo(
      relatoriosFromClient,
      existingRelatorios,
    );

    // Filesystem augmentation: enrich each relatorio with which referenced files are physically missing.
    const relatoriosWithFileStatus =
      await this.checkForMissingFiles(relatoriosFromClient);

    // Overlay missing physical files: request uploads only when safe per freshness rules.
    this.injectMissingURIsToUpdateInfo({
      relatoriosFromClient,
      relatoriosWithFileStatus,
      outdatedOnServer: updateInfoOutput.outdatedOnServer,
      outdatedOnClient: updateInfoOutput.outdatedOnClient,
    });

    console.log(
      '🚀 - SyncService - getRelatorioSyncData - updateInfoOutput:',
      updateInfoOutput,
    );
    return updateInfoOutput;
  }

  private async checkForMissingFiles(relatorios: RelatorioSyncInfo[]) {
    if (!relatorios?.length) return [];

    const uniqueFileIds = [
      ...new Set(
        relatorios.flatMap(
          (r) => [r.assinaturaURI, r.pictureURI].filter(Boolean) as string[],
        ),
      ),
    ];

    const missingFiles = await this.fileService.findMissingFiles(uniqueFileIds);

    return relatorios.map((r) => ({
      ...r,
      _missingFiles: {
        assinaturaURI:
          r.assinaturaURI && missingFiles.includes(r.assinaturaURI)
            ? r.assinaturaURI
            : undefined,
        pictureURI:
          r.pictureURI && missingFiles.includes(r.pictureURI)
            ? r.pictureURI
            : undefined,
      },
    }));
  }

  private injectMissingURIsToUpdateInfo(props: {
    relatoriosFromClient: RelatorioSyncInfo[];
    relatoriosWithFileStatus: (RelatorioSyncInfo & {
      _missingFiles: { assinaturaURI?: string; pictureURI?: string };
    })[];
    outdatedOnServer: Partial<RelatorioSyncInfo>[];
    // When server is newer, full server objects will be here; compare URIs field-by-field
    outdatedOnClient: RelatorioModel[];
  }) {
    const {
      relatoriosFromClient,
      relatoriosWithFileStatus,
      outdatedOnServer,
      outdatedOnClient,
    } = props;

    // Map each id -> which URIs are physically absent so decisions are O(1) per relatorio.
    const missingById = new Map(
      relatoriosWithFileStatus.map((r) => [r.id, r._missingFiles]),
    );

    // Quick lookup tables for patch merging & server-newer discrimination.
    const outdatedById = new Map(outdatedOnServer.map((u) => [u.id, u]));
    const serverNewerById = new Map(
      (outdatedOnClient || []).map((u) => [u.id, u]),
    );

    for (const r of relatoriosFromClient) {
      const missing = missingById.get(r.id);
      if (!missing || (!missing.assinaturaURI && !missing.pictureURI)) continue;

      // Per-field decision:
      //  - Server newer & differing URI → skip (avoid stale overwrite).
      //  - Server newer & equal URI & file missing → request client upload.
      //  - Equal timestamps or client newer & file missing → request upload.
      const serverNewer = serverNewerById.get(r.id);
      const shouldPushAssinatura =
        !!missing.assinaturaURI &&
        (!serverNewer || serverNewer.assinaturaURI === r.assinaturaURI);
      const shouldPushPicture =
        !!missing.pictureURI &&
        (!serverNewer || serverNewer.pictureURI === r.pictureURI);

      // Merge with existing server patch (if any), pruning disallowed fields then adding allowed missing ones.
      const target = outdatedById.get(r.id);
      if (target) {
        // If server is newer and has a different value, strip it to avoid sending stale client URI
        if (
          serverNewer &&
          serverNewer.assinaturaURI !== r.assinaturaURI &&
          'assinaturaURI' in target
        ) {
          delete (target as any).assinaturaURI;
        }
        if (
          serverNewer &&
          serverNewer.pictureURI !== r.pictureURI &&
          'pictureURI' in target
        ) {
          delete (target as any).pictureURI;
        }

        if (shouldPushAssinatura)
          (target as any).assinaturaURI = missing.assinaturaURI;
        if (shouldPushPicture) (target as any).pictureURI = missing.pictureURI;
        continue;
      }

      if (!shouldPushAssinatura && !shouldPushPicture) continue;

      outdatedOnServer.push({
        id: r.id,
        ...(shouldPushAssinatura
          ? { assinaturaURI: missing.assinaturaURI }
          : {}),
        ...(shouldPushPicture ? { pictureURI: missing.pictureURI } : {}),
      });
    }
  }
}

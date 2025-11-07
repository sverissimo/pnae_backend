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

    const updateInfoOutput = RelatorioDomainService.getSyncInfo(
      relatoriosFromClient,
      existingRelatorios,
    );
    // console.log(
    //   '🚀 - SyncService - getRelatorioSyncData - existingRelatorios:',
    //   existingRelatorios.map((r) => ({
    //     id: r.id,
    //     pictureURI: r.pictureURI,
    //     assinaturaURI: r.assinaturaURI,
    //   })),
    // );

    const relatoriosWithFileStatus =
      await this.checkForMissingFiles(relatoriosFromClient);

    this.injectMissingURIsToUpdateInfo({
      relatoriosFromClient,
      relatoriosWithFileStatus,
      outdatedOnServer: updateInfoOutput.outdatedOnServer,
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
  }) {
    const { relatoriosFromClient, relatoriosWithFileStatus, outdatedOnServer } =
      props;

    const missingById = new Map(
      relatoriosWithFileStatus.map((r) => [r.id, r._missingFiles]),
    );

    const outdatedById = new Map(outdatedOnServer.map((u) => [u.id, u]));

    for (const r of relatoriosFromClient) {
      const missing = missingById.get(r.id);
      if (!missing || (!missing.assinaturaURI && !missing.pictureURI)) continue;

      // If this id is already marked for server update, just overlay missing URIs
      const target = outdatedById.get(r.id);
      if (target) {
        if (missing.assinaturaURI) target.assinaturaURI = missing.assinaturaURI;
        if (missing.pictureURI) target.pictureURI = missing.pictureURI;
        continue;
      }

      // Otherwise add a new update payload with only the missing fields
      outdatedOnServer.push({
        id: r.id,
        ...(missing.assinaturaURI
          ? { assinaturaURI: missing.assinaturaURI }
          : {}),
        ...(missing.pictureURI ? { pictureURI: missing.pictureURI } : {}),
      });
    }
  }
}

import { Injectable } from '@nestjs/common';
import { CheckForUpdatesInputDto } from './dto/check-for-updates-input.dto';
import { RelatorioService } from '../relatorios/relatorios.service';
import { RelatorioDomainService } from 'src/@domain/relatorio/relatorio-domain-service';
import { ProdutorSyncInput } from './dto/produtor-sync-input.dto';
import { ProdutorService } from '../produtor/produtor.service';
import { CheckForUpdatesOutputDto } from './dto/check-for-updates-output.dto';
import { compareClientAndServerDates } from './utils/compareClientAndServerDates';
import { ProdutorDTO } from '../produtor/dto';

@Injectable()
export class SyncService {
  constructor(
    private readonly relatorioService: RelatorioService,
    private produtorService: ProdutorService,
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

  async updateRelatoriosData(updatesInput: CheckForUpdatesInputDto) {
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

    return updateInfoOutput;
  }
}

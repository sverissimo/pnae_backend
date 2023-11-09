import { Injectable } from '@nestjs/common';
import { CheckForUpdatesInputDto } from './dto/check-for-updates-input.dto';
import { RelatorioService } from '../relatorios/relatorios.service';
import { RelatorioDomainService } from 'src/@domain/relatorio/relatorio-domain-service';

@Injectable()
export class SystemService {
  constructor(private readonly relatorioService: RelatorioService) {}
  async updateRelatoriosData(updatesInput: CheckForUpdatesInputDto) {
    const { produtorIds, relatoriosSyncInfo: relatoriosFromClient } = updatesInput;

    const ids = relatoriosFromClient.map((r) => r.id);
    const existingRelatorios = await this.relatorioService.findMany({ ids, produtorIds });

    const updateInfoOutput = RelatorioDomainService.getSyncInfo(
      relatoriosFromClient,
      existingRelatorios,
    );

    return updateInfoOutput;
  }
}

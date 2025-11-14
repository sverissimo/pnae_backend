import { Body, Controller, Post } from '@nestjs/common';
import { SyncService } from './sync.service';
import { CheckForUpdatesInputDto } from './dto/check-for-updates-input.dto';
import { ProdutorSyncInput } from './dto/produtor-sync-input.dto';
import { WinstonLoggerService } from 'src/logging/winston-logger.service';

@Controller('sync')
export class SyncController {
  constructor(
    private readonly syncService: SyncService,
    private readonly logger: WinstonLoggerService,
  ) {}

  @Post('produtor')
  async syncProdutor(@Body() produtorSyncInput: ProdutorSyncInput) {
    try {
      const updates =
        await this.syncService.getProdutorSyncInfo(produtorSyncInput);

      return updates;
    } catch (error) {
      if (error.message.includes('Não encontrado')) {
        return { missingIdsOnServer: [produtorSyncInput.produtorId] };
      }
      this.logger.error(
        `SyncController - syncProdutor - syncing produtor: ${produtorSyncInput.produtorId}`,
        error,
      );
      throw error;
    }
  }

  @Post('relatorios')
  async syncRelatorios(@Body() updatesInput: CheckForUpdatesInputDto) {
    try {
      const updates = await this.syncService.getRelatorioSyncData(updatesInput);
      return updates;
    } catch (error) {
      console.log('🚀 - SyncController - syncRelatorios - error:', error);
      this.logger.error(
        `SyncController - syncRelatorios - syncing relatorios: ${updatesInput.relatoriosSyncInfo.map((r) => r.id).join(', ')}`,
        error,
      );

      throw error;
    }
  }
}

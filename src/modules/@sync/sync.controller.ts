import { Body, Controller, Post } from '@nestjs/common';
import { SyncService } from './sync.service';
import { CheckForUpdatesInputDto } from './dto/check-for-updates-input.dto';
import { ProdutorService } from '../produtor/produtor.service';
import { RelatorioService } from '../relatorios/relatorios.service';
import { ProdutorSyncInput } from './dto/produtor-sync-input.dto';

@Controller('sync')
export class SyncController {
  constructor(
    private readonly produtorService: ProdutorService,
    private readonly relatorioService: RelatorioService,
    private readonly syncService: SyncService,
  ) {}

  @Post('produtor')
  async syncProdutor(@Body() produtorSyncInput: ProdutorSyncInput) {
    try {
      const updates = await this.syncService.getProdutorSyncInfo(
        produtorSyncInput,
      );

      return updates;
    } catch (error) {
      if (error.message.includes('Não encontrado')) {
        return { missingIdsOnServer: [produtorSyncInput.produtorId] };
      }
      throw error;
    }
  }

  @Post('relatorios')
  async syncRelatorios(@Body() updatesInput: CheckForUpdatesInputDto) {
    try {
      console.log(
        '🚀 - SyncController - syncRelatorios - updatesInput:',
        updatesInput,
      );
      const updates = await this.syncService.updateRelatoriosData(updatesInput);
      console.log('🚀 - SyncController - syncRelatorios - updates sent:');
      return updates;
    } catch (error) {
      console.log('🚀 - SyncController - syncRelatorios - error:', error);
      throw error;
    }
  }
}

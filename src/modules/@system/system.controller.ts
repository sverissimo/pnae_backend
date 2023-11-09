import { Body, Controller, Post } from '@nestjs/common';
import { SystemService } from './system.service';
import { CheckForUpdatesInputDto } from './dto/check-for-updates-input.dto';
import { ProdutorService } from '../produtor/produtor.service';
import { RelatorioService } from '../relatorios/relatorios.service';

@Controller('system')
export class SystemController {
  constructor(
    private readonly produtorService: ProdutorService,
    private readonly relatorioService: RelatorioService,
    private readonly systemService: SystemService,
  ) {}

  @Post('checkForUpdates')
  async updateRelatoriosData(@Body() updatesInput: CheckForUpdatesInputDto) {
    console.log('🚀 - SystemController - updateRelatoriosData - updatesInput:', updatesInput);
    const updates = await this.systemService.updateRelatoriosData(updatesInput);
    return updates;
  }
}

import { Module } from '@nestjs/common';
import { SyncService } from './sync.service';
import { SyncController } from './sync.controller';
import { RelatorioModule } from '../relatorios/relatorios.module';
import { ProdutorModule } from '../produtor/produtor.module';

@Module({
  controllers: [SyncController],
  providers: [SyncService],
  imports: [ProdutorModule, RelatorioModule],
})
export class SyncModulte {}

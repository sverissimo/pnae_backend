import { Module } from '@nestjs/common';
import { SyncService } from './sync.service';
import { SyncController } from './sync.controller';
import { RelatorioModule } from '../relatorios/relatorios.module';
import { ProdutorModule } from '../produtor/produtor.module';
import { FileModule } from 'src/common/files/file.module';
import { WinstonLoggerService } from 'src/common/logging/winston-logger.service';

@Module({
  controllers: [SyncController],
  providers: [SyncService, WinstonLoggerService],
  imports: [ProdutorModule, RelatorioModule, FileModule],
})
export class SyncModule {}

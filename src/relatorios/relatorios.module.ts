import { Module } from '@nestjs/common';
import { RelatorioService } from './relatorios.service';
import { RelatorioController } from './relatorios.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { FileModule } from 'src/common/file.module';
import { RelatorioAPI } from 'src/@graphQL-server/relatorio-api.service';

@Module({
  imports: [FileModule],
  controllers: [RelatorioController],
  providers: [RelatorioService, PrismaService, RelatorioAPI],
  exports: [RelatorioService],
})
export class VisitasModule {}

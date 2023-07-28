import { Module } from '@nestjs/common';
import { RelatorioService } from './relatorios.service';
import { RelatorioController } from './relatorios.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { FileModule } from 'src/common/file.module';

@Module({
  imports: [FileModule],
  controllers: [RelatorioController],
  providers: [RelatorioService, PrismaService],
  exports: [RelatorioService],
})
export class VisitasModule {}

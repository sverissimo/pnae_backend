import { Module } from '@nestjs/common';
import { VisitasService } from './visitas.service';
import { VisitasController } from './visitas.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { FileModule } from 'src/common/file.module';

@Module({
  imports: [FileModule],
  controllers: [VisitasController],
  providers: [VisitasService, PrismaService],
})
export class VisitasModule {}

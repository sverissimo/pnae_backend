import { Module } from '@nestjs/common';
import { VisitasService } from './visitas.service';
import { VisitasController } from './visitas.controller';
import { FileService } from 'src/common/file.service';
import { PrismaService } from 'src/prisma/prisma.service';

@Module({
  controllers: [VisitasController],
  providers: [VisitasService, FileService, PrismaService],
})
export class VisitasModule {}

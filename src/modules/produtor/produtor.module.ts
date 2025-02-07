import { Module } from '@nestjs/common';
import { ProdutorService } from './produtor.service';
import { ProdutorController } from './produtor.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { ProdutorGraphQLAPI } from 'src/@graphQL-server/produtor-api.service';
import { RelatorioModule } from 'src/modules/relatorios/relatorios.module';
import { WinstonLoggerService } from 'src/common/logging/winston-logger.service';

@Module({
  controllers: [ProdutorController],
  providers: [
    PrismaService,
    ProdutorGraphQLAPI,
    // RelatorioGraphQLAPI,
    ProdutorService,
    { provide: WinstonLoggerService, useClass: WinstonLoggerService },
  ],
  imports: [RelatorioModule],
  exports: [ProdutorService],
})
export class ProdutorModule {}

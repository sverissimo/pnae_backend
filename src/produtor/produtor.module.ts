import { Module } from '@nestjs/common';
import { ProdutorService } from './produtor.service';
import { ProdutorController } from './produtor.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { RelatorioService } from 'src/relatorios/relatorios.service';
import { ProdutorGraphQLAPI } from 'src/@graphQL-server/produtor-api.service';
import { RelatorioGraphQLAPI } from 'src/@graphQL-server/relatorio-api.service';

@Module({
  controllers: [ProdutorController],
  providers: [
    ProdutorService,
    RelatorioService,
    PrismaService,
    ProdutorGraphQLAPI,
    RelatorioGraphQLAPI,
  ],
})
export class ProdutorModule {}

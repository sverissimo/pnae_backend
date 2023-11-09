import { Module } from '@nestjs/common';
import { ProdutorService } from './produtor.service';
import { ProdutorController } from './produtor.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { ProdutorGraphQLAPI } from 'src/@graphQL-server/produtor-api.service';
import { RelatorioGraphQLAPI } from 'src/@graphQL-server/relatorio-api.service';
import { RelatorioModule } from 'src/modules/relatorios/relatorios.module';

@Module({
  controllers: [ProdutorController],
  providers: [PrismaService, ProdutorGraphQLAPI, RelatorioGraphQLAPI, ProdutorService],
  imports: [RelatorioModule],
  exports: [ProdutorService],
})
export class ProdutorModule {}

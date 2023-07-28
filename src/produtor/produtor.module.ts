import { Module } from '@nestjs/common';
import { ProdutorService } from './produtor.service';
import { ProdutorController } from './produtor.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { GraphQLApiGateway } from 'src/common/graphql-api.service';
import { RelatorioService } from 'src/relatorios/relatorios.service';

@Module({
  controllers: [ProdutorController],
  providers: [ProdutorService, RelatorioService, PrismaService, GraphQLApiGateway],
})
export class ProdutorModule {}

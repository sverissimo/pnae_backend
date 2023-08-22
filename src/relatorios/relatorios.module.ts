import { Module } from '@nestjs/common';
import { RelatorioService } from './relatorios.service';
import { RelatorioController } from './relatorios.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { FileModule } from 'src/common/file.module';
import { RelatorioGraphQLAPI } from 'src/@graphQL-server/relatorio-api.service';
import { UsuarioGraphQLAPI } from 'src/@graphQL-server/usuario-api.service';

@Module({
  imports: [FileModule],
  controllers: [RelatorioController],
  providers: [RelatorioService, PrismaService, RelatorioGraphQLAPI, UsuarioGraphQLAPI],
  exports: [RelatorioService],
})
export class RelatorioModule {}

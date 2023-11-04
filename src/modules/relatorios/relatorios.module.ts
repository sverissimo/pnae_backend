import { Module } from '@nestjs/common';
import { RelatorioService } from './relatorios.service';
import { RelatorioController } from './relatorios.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { FileModule } from 'src/common/file.module';
import { RelatorioGraphQLAPI } from 'src/@graphQL-server/relatorio-api.service';
import { UsuarioGraphQLAPI } from 'src/@graphQL-server/usuario-api.service';
import { ProdutorGraphQLAPI } from 'src/@graphQL-server/produtor-api.service';
import { RestAPI } from 'src/@rest-api-server/rest-api.service';
import { AtendimentoModule } from 'src/modules/atendimento/atendimento.module';

@Module({
  controllers: [RelatorioController],
  providers: [
    PrismaService,
    RelatorioGraphQLAPI,
    ProdutorGraphQLAPI,
    RelatorioService,
    { provide: UsuarioGraphQLAPI, useClass: UsuarioGraphQLAPI },
    { provide: RestAPI, useClass: RestAPI },
  ],
  imports: [FileModule, AtendimentoModule],
  exports: [RelatorioService],
})
export class RelatorioModule {}

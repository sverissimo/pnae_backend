import { Module } from '@nestjs/common';
import { RelatorioService } from './relatorios.service';
import { RelatorioController } from './relatorios.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { FileModule } from 'src/modules/files/file.module';
import { UsuarioGraphQLAPI } from 'src/@graphQL-server/usuario-api.service';
import { ProdutorGraphQLAPI } from 'src/@graphQL-server/produtor-api.service';
import { RestAPI } from 'src/@rest-api-server/rest-api.service';
import { AtendimentoModule } from 'src/modules/atendimento/atendimento.module';
import { WinstonLoggerService } from 'src/logging/winston-logger.service';
import { ProdutorService } from '../produtor/produtor.service';
import { RelatorioExportService } from './relatorios.export.service';
import { ZipWorkerService } from './workers/zip.worker.service';
import { PerfilModule } from '../perfil/perfil.module';

@Module({
  controllers: [RelatorioController],
  providers: [
    PrismaService,
    ProdutorGraphQLAPI,
    RelatorioService,
    RelatorioExportService,
    ProdutorService,
    ZipWorkerService,
    { provide: UsuarioGraphQLAPI, useClass: UsuarioGraphQLAPI },
    { provide: RestAPI, useClass: RestAPI },
    { provide: WinstonLoggerService, useClass: WinstonLoggerService },
  ],
  imports: [FileModule, AtendimentoModule, PerfilModule],
  exports: [RelatorioService],
})
export class RelatorioModule {}

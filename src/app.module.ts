import { Module } from '@nestjs/common';
import { AppService } from './app.service';
import { RelatorioModule } from './modules/relatorios/relatorios.module';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { ProdutorModule } from './modules/produtor/produtor.module';
import { PerfilModule } from './modules/perfil/perfil.module';
import { config } from './config';
import { UsuarioController } from './modules/usuario/usuario.controller';
import { UsuarioGraphQLAPI } from './@graphQL-server/usuario-api.service';
import { AtendimentoModule } from './modules/atendimento/atendimento.module';
import { SyncModulte } from './modules/@sync/sync.module';
import { UsuarioLdapService } from './modules/usuario/usuario.ldap.service';
import { WinstonLoggerService } from './common/logging/winston-logger.service';
import { APP_INTERCEPTOR } from '@nestjs/core';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [config] }),
    RelatorioModule,
    ProdutorModule,
    PerfilModule,
    AtendimentoModule,
    SyncModulte,
  ],
  controllers: [AppController, UsuarioController],
  providers: [
    AppService,
    UsuarioGraphQLAPI,
    UsuarioLdapService,
    {
      provide: APP_INTERCEPTOR,
      useClass: WinstonLoggerService,
    },
  ],
})
export class AppModule {}

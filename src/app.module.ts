import { MiddlewareConsumer, Module } from '@nestjs/common';
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
import { WinstonLoggerService } from './common/logging/winston-logger.service';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuthMiddleware } from './auth/auth.middleware';
import { AuthController } from './auth/auth.controller';
import { UserContextMiddleware } from './auth/user-context.middleware';
import { JwtModule } from '@nestjs/jwt';
import { SyncModule } from './modules/@sync/sync.module';
import { RestAPI } from './@rest-api-server/rest-api.service';
import { UserHydrationInterceptor } from './interceptors/user-hydration.interceptor';
import { UsuarioModule } from './modules/usuario/usuario.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [config] }),
    RelatorioModule,
    ProdutorModule,
    PerfilModule,
    AtendimentoModule,
    SyncModule,
    UsuarioModule,
    JwtModule.register({
      secret: process.env.CLIENT_TOKEN,
      signOptions: { expiresIn: '2h' },
    }),
  ],
  controllers: [AppController, UsuarioController, AuthController],
  providers: [
    AppService,
    UsuarioGraphQLAPI,
    RestAPI,
    {
      provide: APP_INTERCEPTOR,
      useClass: WinstonLoggerService,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: UserHydrationInterceptor,
    },
  ],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AuthMiddleware, UserContextMiddleware).forRoutes('*');
  }
}

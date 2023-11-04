import { join } from 'path';
import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
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

/* (BigInt.prototype as any).toJSON = function () {
  const int = Number.parseInt(this.toString());
  return int ?? this.toString();
};
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [config] }),
    /* ServeStaticModule.forRoot({
      //rootPath: join(__dirname, '../client', 'src'),
      rootPath: join(__dirname, '../client', 'src'),
      exclude: ['/api/(.*)'],
    }), */
    RelatorioModule,
    ProdutorModule,
    PerfilModule,
    AtendimentoModule,
  ],
  controllers: [AppController, UsuarioController],
  providers: [AppService, UsuarioGraphQLAPI],
})
export class AppModule {}

import { join } from 'path';
import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { AppService } from './app.service';
import { RelatorioModule } from './relatorios/relatorios.module';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { ProdutorModule } from './produtor/produtor.module';
import { PerfilModule } from './perfil/perfil.module';
import { config } from './config';
import { UsuarioController } from './usuario/usuario.controller';
import { UsuarioGraphQLAPI } from './@graphQL-server/usuario-api.service';

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
  ],
  controllers: [AppController, UsuarioController],
  providers: [AppService, UsuarioGraphQLAPI],
})
export class AppModule {}

import { join } from 'path';
import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { AppService } from './app.service';
import { VisitasModule } from './relatorios/relatorios.module';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { ProdutorModule } from './produtor/produtor.module';
import { PerfilModule } from './perfil/perfil.module';
import { config } from './config';

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
    VisitasModule,
    ProdutorModule,
    PerfilModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

import { join } from 'path';
import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { AppService } from './app.service';
import { VisitasModule } from './relatorios/relatorios.module';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { ProdutorModule } from './produtor/produtor.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    /* ServeStaticModule.forRoot({
      //rootPath: join(__dirname, '../client', 'src'),
      rootPath: join(__dirname, '../client', 'src'),
      exclude: ['/api/(.*)'],
    }), */
    VisitasModule,
    ProdutorModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

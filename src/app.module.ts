import { join } from 'path';
import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { AppService } from './app.service';
import { VisitasModule } from './relatorios/relatorios.module';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    /* ServeStaticModule.forRoot({
      //rootPath: join(__dirname, '../client', 'src'),
      rootPath: join(__dirname, '../client', 'src'),
      exclude: ['/api/(.*)'],
    }), */
    VisitasModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

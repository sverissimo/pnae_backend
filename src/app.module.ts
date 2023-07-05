import { join } from 'path';
import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { AppService } from './app.service';
import { VisitasModule } from './visitas/visitas.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '../client', 'src'),
      exclude: ['/api/(.*)'],
    }),
    VisitasModule,
  ],
  providers: [AppService],
})
export class AppModule {}

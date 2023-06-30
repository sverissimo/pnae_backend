import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { VisitasModule } from './visitas/visitas.module';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';

@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'src'),
      exclude: ['/api/(.*)'],
    }),
    VisitasModule,
  ],
  //controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

console.log(join(__dirname, '..', 'src', 'tempForm.html'));

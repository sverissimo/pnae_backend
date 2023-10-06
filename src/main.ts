import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { BigIntInterceptor } from './interceptors/big-int.interceptor';
import * as fs from 'fs';

async function bootstrap() {
  // const app = await NestFactory.create(AppModule);
  const httpsOptions = {
    key: fs.readFileSync('certificates/key.pem'),
    cert: fs.readFileSync('certificates/emater.crt'),
  };
  const app = await NestFactory.create(AppModule, {
    httpsOptions,
  });
  app.enableCors();
  app.useGlobalInterceptors(new BigIntInterceptor());

  await app.listen(3000);
}

bootstrap();

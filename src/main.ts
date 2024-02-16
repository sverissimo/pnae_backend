import * as fs from 'fs';
import * as path from 'path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { BigIntInterceptor } from './interceptors/big-int.interceptor';

async function bootstrap() {
  const keyPath = path.join(__dirname, '..', 'certificates', 'key.pem');
  const certPath = path.join(__dirname, '..', 'certificates', 'emater.crt');
  const env = process.env.NODE_ENV;

  const httpsOptions = {
    key: fs.readFileSync(keyPath),
    cert: fs.readFileSync(certPath),
  };

  const PORT = process.env.PORT || 3000;

  const app =
    env === 'production'
      ? await NestFactory.create(AppModule)
      : await NestFactory.create(AppModule, { httpsOptions });

  app.enableCors();
  app.useGlobalInterceptors(new BigIntInterceptor());
  await app.listen(PORT, '0.0.0.0');
  console.log(`Application is running on: ${PORT}`);
}

bootstrap();

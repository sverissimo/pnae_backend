import * as fs from 'fs';
import * as path from 'path';
import * as bodyParser from 'body-parser';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { BigIntInterceptor } from './interceptors/big-int.interceptor';
import { WinstonLoggerService } from './common/logging/winston-logger.service';
import { NestExpressApplication } from '@nestjs/platform-express';

async function bootstrap() {
  const keyPath = path.join(
    __dirname,
    '..',
    'certificates',
    'csr-key-emater.pem',
  );

  const certPath = path.join(
    __dirname,
    '..',
    'certificates',
    'STAR_emater_mg_gov_br.combined.crt',
  );
  const env = process.env.NODE_ENV;

  const httpsOptions = {
    key: fs.readFileSync(keyPath),
    cert: fs.readFileSync(certPath),
  };

  const PORT = process.env.PORT || 3000;
  const logger = { logger: new WinstonLoggerService() };

  const app = await NestFactory.create<NestExpressApplication>(
    AppModule,
    logger,
  );
  // const app =
  //   env === 'production'
  //     ? await NestFactory.create<NestExpressApplication>(AppModule, logger)
  //     : await NestFactory.create<NestExpressApplication>(AppModule, {
  //         httpsOptions,
  //         ...logger,
  //       });

  app.use(bodyParser.json({ limit: '5mb' }));
  app.use(bodyParser.urlencoded({ limit: '5mb', extended: true }));

  app.enableCors();
  app.useGlobalInterceptors(new BigIntInterceptor());
  await app.listen(PORT, '0.0.0.0');
  console.log(`Application is running on: ${PORT}`);
}

bootstrap();

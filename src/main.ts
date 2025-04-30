import * as bodyParser from 'body-parser';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { BigIntInterceptor } from './interceptors/big-int.interceptor';
import { WinstonLoggerService } from './common/logging/winston-logger.service';
import { NestExpressApplication } from '@nestjs/platform-express';

async function bootstrap() {
  const PORT = process.env.PORT || 3000;
  const logger = { logger: new WinstonLoggerService() };

  const app = await NestFactory.create<NestExpressApplication>(
    AppModule,
    logger,
  );

  app.use(bodyParser.json({ limit: '5mb' }));
  app.use(bodyParser.urlencoded({ limit: '5mb', extended: true }));

  app.enableCors();
  app.useGlobalInterceptors(new BigIntInterceptor());
  await app.listen(PORT, '0.0.0.0');
  console.log(`Application is running on: ${PORT}`);
}

bootstrap();

import * as bodyParser from 'body-parser';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { BigIntInterceptor } from './interceptors/big-int.interceptor';
import { WinstonLoggerService } from './common/logging/winston-logger.service';
import { NestExpressApplication } from '@nestjs/platform-express';
import { PlainTextExceptionFilter } from './common/filters/plain-text-exception.filter';

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

  // app.useGlobalFilters(new TempErrorNormalizeFilter());
  app.useGlobalFilters(new PlainTextExceptionFilter()); // TEMPORARY: normalize error responses to plain string for older mobile client
  await app.listen(PORT, '0.0.0.0');
  console.log(`Application is running on: ${PORT}`);
}

bootstrap();

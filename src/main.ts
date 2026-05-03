import * as bodyParser from 'body-parser';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { BigIntInterceptor } from './interceptors/big-int.interceptor';
import { WinstonLoggerService } from './logging/winston-logger.service';
import { NestExpressApplication } from '@nestjs/platform-express';
import { PlainTextExceptionFilter } from './filters/plain-text-exception.filter';
import cookieParser = require('cookie-parser');

async function bootstrap() {
  const PORT = process.env.PORT || 3000;
  const logger = { logger: new WinstonLoggerService() };

  const corsAllowedOrigins = new Set(
    (process.env.CORS_ALLOWED_ORIGINS ?? '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  );

  const app = await NestFactory.create<NestExpressApplication>(
    AppModule,
    logger,
  );

  app.use(bodyParser.json({ limit: '5mb' }));
  app.use(bodyParser.urlencoded({ limit: '5mb', extended: true }));
  app.use(cookieParser());

  if (process.env.NODE_ENV === 'production') {
    app.enableCors({ credentials: true });
  } else {
    app.enableCors({
      credentials: true,
      origin: (origin, callback) => {
        if (!origin || corsAllowedOrigins.has(origin)) {
          callback(null, true);
          return;
        }

        callback(new Error(`Origin ${origin} is not allowed by CORS`));
      },
    });
  }

  app.useGlobalInterceptors(new BigIntInterceptor());

  // app.useGlobalFilters(new TempErrorNormalizeFilter());
  app.useGlobalFilters(new PlainTextExceptionFilter()); // TEMPORARY: normalize error responses to plain string for older mobile client
  app.enableShutdownHooks();
  await app.listen(PORT, '0.0.0.0');
  console.log(`Application is running on: ${PORT}`);
}

bootstrap();

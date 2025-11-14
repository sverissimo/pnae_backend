import { ConsoleLogger, Injectable } from '@nestjs/common';
import {
  createLogger,
  format,
  transports,
  Logger as WinstonLogger,
} from 'winston';
import * as DailyRotateFile from 'winston-daily-rotate-file';

@Injectable()
export class WinstonLoggerService extends ConsoleLogger {
  private winstonLogger: WinstonLogger;

  constructor() {
    super();
    const logFormat = this.createLogFormat();
    const debugTransport = this.createDebugTransport();
    const { LOGS_FOLDER } = process.env;

    this.winstonLogger = createLogger({
      level: 'error',
      format: logFormat,
      transports: [
        new DailyRotateFile({
          filename: `${LOGS_FOLDER}/errors-%DATE%.log`,
          maxSize: '20m',
          maxFiles: '14d',
          level: 'error',
        }),
      ],
    });

    // if (process.env.NODE_ENV !== 'production') {
    //   this.winstonLogger.add(debugTransport);
    // }
  }

  private createLogFormat() {
    return format.combine(
      format.timestamp({
        format: () => {
          const date = new Date();
          date.setHours(date.getUTCHours() - 3);
          return date
            .toISOString()
            .split('.')[0]
            .replace('T', ' ')
            .replace('Z', '');
        },
      }),
      format.errors({ stack: true }), // ensures Error.stack => info.stack
      format.splat(),
      // keep format.simple removed (it can interfere) and use printf that prints stack+meta
      format.printf((info: any) => {
        const { timestamp, level, message, stack, ...meta } = info;
        const metaKeys = Object.keys(meta);
        const metaStr = metaKeys.length ? ` ${JSON.stringify(meta)}` : '';
        if (stack) {
          return `${timestamp} ${level}: ${message}\n${stack}${metaStr}`;
        }
        return `${timestamp} ${level}: ${message}${metaStr}`;
      }),
    );
  }

  private createDebugTransport() {
    return new transports.Console({
      level: 'debug',
      format: format.combine(
        format.colorize(),
        format.printf(({ level, message, timestamp }) => {
          return `${timestamp} - ${level}: ${message}`;
        }),
      ),
    });
  }

  error(message: string | Error, meta?: any) {
    // keep console output for Nest
    if (message instanceof Error) {
      // let winston capture the stack via format.errors
      this.winstonLogger.error(message);
      if (process.env.NODE_ENV !== 'production')
        super.warn(message.stack || message.message);

      return;
    }

    if (meta) {
      this.winstonLogger.error(message, meta);
    } else {
      this.winstonLogger.error(message);
    }

    if (process.env.NODE_ENV !== 'production') super.warn(message);
  }
}

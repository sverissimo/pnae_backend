import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  constructor() {
    super({
      //log: ['query', 'info', 'warn', 'error'],
      log: ['info', 'warn', 'error'],
    });
  }
  async onModuleInit() {
    await this.$connect();
  }

  async enableShutDownHooks(app: any) {
    this.$on('beforeExit', async () => await app.close());
  }
}

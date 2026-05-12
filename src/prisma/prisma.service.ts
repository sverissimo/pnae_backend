import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from 'src/prisma/generated/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  constructor() {
    const adapter = new PrismaPg({
      connectionString: process.env.DATABASE_URL,
    });

    super({
      adapter,
      //log: ['query', 'info', 'warn', 'error'],
      log: ['info', 'warn', 'error'],
    });
  }
  async onModuleInit() {
    await this.$connect();
  }
}

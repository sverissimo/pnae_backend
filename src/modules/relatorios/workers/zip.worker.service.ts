import IORedis from 'ioredis';
import { Worker } from 'bullmq';
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { RelatorioExportService } from '../relatorios.export.service';

@Injectable()
export class ZipWorkerService implements OnModuleInit, OnModuleDestroy {
  private worker: Worker | null = null;
  private connection: IORedis | null = null;

  private readonly QUEUE_NAME = process.env.ZIP_QUEUE_NAME || 'zip-generation';

  constructor(private readonly exportService: RelatorioExportService) {}

  async onModuleInit(): Promise<void> {
    this.connection = new IORedis({
      host: process.env.REDIS_HOST || 'redis',
      port: Number(process.env.REDIS_PORT) || 6379,
      maxRetriesPerRequest: null,
    });

    this.worker = new Worker(
      this.QUEUE_NAME,
      async (job) => {
        const { from, to } = job.data as { from: string; to: string };
        return this.exportService.createZipFile({ from, to });
      },
      {
        connection: {
          host: process.env.REDIS_HOST || 'redis',
          port: Number(process.env.REDIS_PORT) || 6379,
          maxRetriesPerRequest: null,
        },
      },
    );

    this.worker.on('completed', (job, result) => {
      // Optional logging
      console.log(`[ZipWorker] Job ${job.id} completed:`, result);
    });

    this.worker.on('failed', (job, err) => {
      // Optional logging
      console.error(
        `[ZipWorker] Job ${job?.id} failed: ${err.message}`,
        err.stack,
      );
    });
  }

  async onModuleDestroy(): Promise<void> {
    try {
      if (this.worker) await this.worker.close();
    } finally {
      if (this.connection) await this.connection.quit();
      this.worker = null;
      this.connection = null;
    }
  }
}

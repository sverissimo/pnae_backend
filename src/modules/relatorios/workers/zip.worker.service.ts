import IORedis from 'ioredis';
import { Worker } from 'bullmq';
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { RelatorioExportService } from '../relatorios.export.service';
import { createRedisConnection } from 'src/redis/redis.provider';

@Injectable()
export class ZipWorkerService implements OnModuleInit, OnModuleDestroy {
  private worker: Worker | null = null;
  private connection: IORedis | null = null;

  private readonly QUEUE_NAME = process.env.ZIP_QUEUE_NAME || 'zip-generation';

  constructor(private readonly exportService: RelatorioExportService) {}

  async onModuleInit(): Promise<void> {
    this.connection = createRedisConnection();

    this.worker = new Worker(
      this.QUEUE_NAME,
      async (job) => {
        const { from, to } = job.data as { from: string; to: string };
        return this.exportService.createZipFile({ from, to });
      },
      { connection: this.connection },
    );

    this.worker.on('completed', (job, result) => {
      console.log(`[ZipWorker] Job ${job.id} completed:`, result);
    });

    this.worker.on('failed', (job, err) => {
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

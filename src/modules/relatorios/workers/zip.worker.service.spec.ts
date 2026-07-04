jest.mock('p-limit', () => ({
  __esModule: true,
  default: () => <T>(fn: () => Promise<T>) => fn(),
}));
jest.mock('graphql-request', () => ({
  gql: (literals: TemplateStringsArray) => literals[0],
  GraphQLClient: jest.fn().mockImplementation(() => ({ request: jest.fn() })),
}));
jest.mock('bullmq', () => ({
  Worker: jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    close: jest.fn(),
  })),
}));
jest.mock('src/redis/redis.provider', () => ({
  createRedisConnection: jest.fn(() => ({ quit: jest.fn() })),
}));

import { Worker } from 'bullmq';
import { ZipWorkerService } from './zip.worker.service';

describe('ZipWorkerService', () => {
  it('passes atendimentoIds from the job data into createZipFile', async () => {
    const exportService = {
      createZipFile: jest.fn().mockResolvedValue('Arquivo gerado: /tmp/x.zip'),
    } as any;
    const workerService = new ZipWorkerService(exportService);

    await workerService.onModuleInit();

    const processor = (Worker as unknown as jest.Mock).mock.calls[0][1];
    const result = await processor({
      data: { userId: '10', atendimentoIds: ['1', '2'] },
    });

    expect(exportService.createZipFile).toHaveBeenCalledWith({
      atendimentoIds: ['1', '2'],
    });
    expect(result).toBe('Arquivo gerado: /tmp/x.zip');
  });
});

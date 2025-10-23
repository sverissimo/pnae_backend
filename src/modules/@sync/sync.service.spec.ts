jest.mock('graphql-request', () => ({
  gql: (literals: TemplateStringsArray) => literals[0],
  GraphQLClient: jest.fn().mockImplementation(() => ({
    request: jest.fn(),
  })),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { SyncService } from './sync.service';
import { RelatorioService } from '../relatorios/relatorios.service';
import { ProdutorService } from '../produtor/produtor.service';
import { FileService } from 'src/common/files/file.service';
import { RelatorioDomainService } from 'src/@domain/relatorio/relatorio-domain-service';
import { CheckForUpdatesInputDto } from './dto/check-for-updates-input.dto';
import { RelatorioSyncInfo } from './dto/check-for-updates-input.dto';

jest.mock('src/@domain/relatorio/relatorio-domain-service');

describe('SyncService', () => {
  let service: SyncService;
  const relatorioService = {
    findMany: jest.fn(),
  };
  const produtorService = {
    findOne: jest.fn(),
  };
  const fileService = {
    findMissingFiles: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SyncService,
        { provide: RelatorioService, useValue: relatorioService },
        { provide: ProdutorService, useValue: produtorService },
        { provide: FileService, useValue: fileService },
      ],
    }).compile();

    service = module.get<SyncService>(SyncService);
  });

  describe('getProdutorSyncInfo', () => {
    const baseProdutor: any = {
      id_pessoa_demeter: BigInt(10),
      dt_update_record: null,
    };

    it('returns missingIdsOnServer when produtor does not exist', async () => {
      produtorService.findOne.mockResolvedValue(undefined);

      const result = await service.getProdutorSyncInfo({
        produtorId: '10',
        updatedAt: undefined,
      });

      expect(result).toEqual({ missingIdsOnServer: ['10'] });
      expect(produtorService.findOne).toHaveBeenCalledWith('10');
    });

    it('returns upToDateIds when both dates are empty', async () => {
      produtorService.findOne.mockResolvedValue(baseProdutor);

      const result = await service.getProdutorSyncInfo({
        produtorId: '10',
        updatedAt: undefined,
      });

      expect(result).toEqual({ upToDateIds: ['10'] });
    });

    it('returns outdatedOnClient when server is newer', async () => {
      produtorService.findOne.mockResolvedValue({
        ...baseProdutor,
        dt_update_record: '2024-01-02T00:00:00Z',
      });

      const result = await service.getProdutorSyncInfo({
        produtorId: '10',
        updatedAt: '2024-01-01T00:00:00Z',
      });

      expect(result).toEqual({
        outdatedOnClient: [
          {
            ...baseProdutor,
            dt_update_record: '2024-01-02T00:00:00Z',
          },
        ],
      });
    });

    it('returns outdatedOnServer when client is newer', async () => {
      produtorService.findOne.mockResolvedValue({
        ...baseProdutor,
        dt_update_record: '2024-01-01T00:00:00Z',
      });

      const result = await service.getProdutorSyncInfo({
        produtorId: '10',
        updatedAt: '2024-01-03T00:00:00Z',
      });

      expect(result).toEqual({
        outdatedOnServer: [{ id_pessoa_demeter: BigInt(10) }],
      });
    });

    it('rethrows underlying errors from produtorService', async () => {
      const err = new Error('db down');
      produtorService.findOne.mockRejectedValue(err);

      await expect(
        service.getProdutorSyncInfo({ produtorId: '10', updatedAt: undefined }),
      ).rejects.toThrow(err);
    });
  });

  describe('getRelatorioSyncData', () => {
    const mockSyncInfo = (
      overrides: Partial<ReturnType<typeof RelatorioDomainService.getSyncInfo>>,
    ) => ({
      upToDateIds: [],
      missingIdsOnServer: [],
      outdatedOnClient: [],
      outdatedOnServer: [],
      missingOnClient: [],
      ...overrides,
    });

    const baseInput: CheckForUpdatesInputDto = {
      produtorIds: ['200'],
      relatoriosSyncInfo: [
        {
          id: 'rel-1',
          assinaturaURI: 'sig-1',
          pictureURI: 'pic-1',
          updatedAt: '2024-01-01T00:00:00Z',
        },
        {
          id: 'rel-2',
          assinaturaURI: 'sig-2',
          pictureURI: 'pic-2',
          updatedAt: '2024-01-02T00:00:00Z',
        },
      ] as RelatorioSyncInfo[],
    };

    beforeEach(() => {
      relatorioService.findMany.mockResolvedValue([{ id: 'rel-1' }]);
      fileService.findMissingFiles.mockResolvedValue([]);
      (RelatorioDomainService.getSyncInfo as jest.Mock).mockReturnValue(
        mockSyncInfo({}),
      );
    });

    it('fetches existing relatorios and returns sync info', async () => {
      const result = await service.getRelatorioSyncData(baseInput);

      expect(relatorioService.findMany).toHaveBeenCalledWith({
        ids: ['rel-1', 'rel-2'],
        produtorIds: ['200'],
      });
      expect(RelatorioDomainService.getSyncInfo).toHaveBeenCalledWith(
        baseInput.relatoriosSyncInfo,
        [{ id: 'rel-1' }],
      );
      expect(fileService.findMissingFiles).toHaveBeenCalledWith([
        'sig-1',
        'pic-1',
        'sig-2',
        'pic-2',
      ]);
      expect(result).toEqual(
        mockSyncInfo({}), // same instance returned from spy
      );
    });

    it('adds missing files to outdatedOnServer when not already present', async () => {
      fileService.findMissingFiles.mockResolvedValue(['sig-2']);

      const syncInfo = mockSyncInfo({});
      (RelatorioDomainService.getSyncInfo as jest.Mock).mockReturnValue(
        syncInfo,
      );

      const result = await service.getRelatorioSyncData(baseInput);

      expect(result.outdatedOnServer).toEqual([
        { id: 'rel-2', assinaturaURI: 'sig-2' },
      ]);
    });

    it('merges missing files into existing outdatedOnServer entry', async () => {
      fileService.findMissingFiles.mockResolvedValue(['pic-1']);

      const existingOutdated = { id: 'rel-1', assinaturaURI: 'sig-1' };
      const syncInfo = mockSyncInfo({
        outdatedOnServer: [existingOutdated],
      });
      (RelatorioDomainService.getSyncInfo as jest.Mock).mockReturnValue(
        syncInfo,
      );

      const result = await service.getRelatorioSyncData(baseInput);

      expect(result.outdatedOnServer).toHaveLength(1);
      expect(result.outdatedOnServer[0]).toEqual({
        id: 'rel-1',
        assinaturaURI: 'sig-1',
        pictureURI: 'pic-1',
      });
    });

    it('returns empty missing file info when no relatorios provided', async () => {
      const input: CheckForUpdatesInputDto = {
        produtorIds: [],
        relatoriosSyncInfo: [],
      };
      const syncInfo = mockSyncInfo({});
      (RelatorioDomainService.getSyncInfo as jest.Mock).mockReturnValue(
        syncInfo,
      );

      const result = await service.getRelatorioSyncData(input);

      expect(fileService.findMissingFiles).not.toHaveBeenCalled();
      expect(result).toBe(syncInfo);
    });
  });
});

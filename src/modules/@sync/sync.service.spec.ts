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

    it('does not request upload when server is newer and URI differs (assinaturaURI)', async () => {
      const input: CheckForUpdatesInputDto = {
        produtorIds: [],
        relatoriosSyncInfo: [
          {
            id: 'rel-x',
            assinaturaURI: 'sig-x',
            pictureURI: 'pic-x',
            updatedAt: '2024-01-01T00:00:00Z',
          },
        ] as RelatorioSyncInfo[],
      };

      relatorioService.findMany.mockResolvedValue([{ id: 'rel-x' }]);
      fileService.findMissingFiles.mockResolvedValue(['sig-x']);

      const syncInfo = mockSyncInfo({
        // server is newer and has a different assinaturaURI value
        outdatedOnClient: [{ id: 'rel-x', assinaturaURI: 'sig-new' } as any],
      });
      (RelatorioDomainService.getSyncInfo as jest.Mock).mockReturnValue(
        syncInfo,
      );

      const result = await service.getRelatorioSyncData(input);
      // Since server newer and assinatura differs, we do NOT ask client to upload assinatura
      expect(result.outdatedOnServer).toEqual([]);
    });

    it('requests upload when server is newer but URI is equal and file missing (assinaturaURI)', async () => {
      const input: CheckForUpdatesInputDto = {
        produtorIds: [],
        relatoriosSyncInfo: [
          {
            id: 'rel-y',
            assinaturaURI: 'sig-y',
            pictureURI: 'pic-y',
            updatedAt: '2024-01-01T00:00:00Z',
          },
        ] as RelatorioSyncInfo[],
      };

      relatorioService.findMany.mockResolvedValue([{ id: 'rel-y' }]);
      fileService.findMissingFiles.mockResolvedValue(['sig-y']);

      const syncInfo = mockSyncInfo({
        // server newer but has the same assinatura value
        outdatedOnClient: [{ id: 'rel-y', assinaturaURI: 'sig-y' } as any],
      });
      (RelatorioDomainService.getSyncInfo as jest.Mock).mockReturnValue(
        syncInfo,
      );

      const result = await service.getRelatorioSyncData(input);
      expect(result.outdatedOnServer).toEqual([
        { id: 'rel-y', assinaturaURI: 'sig-y' },
      ]);
    });

    it('per-field behavior: skip differing assinatura but request equal picture when both missing', async () => {
      const input: CheckForUpdatesInputDto = {
        produtorIds: [],
        relatoriosSyncInfo: [
          {
            id: 'rel-z',
            assinaturaURI: 'sig-z',
            pictureURI: 'pic-z',
            updatedAt: '2024-01-01T00:00:00Z',
          },
        ] as RelatorioSyncInfo[],
      };

      relatorioService.findMany.mockResolvedValue([{ id: 'rel-z' }]);
      fileService.findMissingFiles.mockResolvedValue(['sig-z', 'pic-z']);

      const syncInfo = mockSyncInfo({
        // server newer, assinatura differs but picture equals
        outdatedOnClient: [
          { id: 'rel-z', assinaturaURI: 'sig-new', pictureURI: 'pic-z' } as any,
        ],
      });
      (RelatorioDomainService.getSyncInfo as jest.Mock).mockReturnValue(
        syncInfo,
      );

      const result = await service.getRelatorioSyncData(input);
      // Should only request picture upload, not assinatura
      expect(result.outdatedOnServer).toEqual([
        { id: 'rel-z', pictureURI: 'pic-z' },
      ]);
    });

    it('merges into existing outdatedOnServer but honors server-newer/different rule', async () => {
      const input: CheckForUpdatesInputDto = {
        produtorIds: [],
        relatoriosSyncInfo: [
          {
            id: 'rel-w',
            assinaturaURI: 'sig-w',
            pictureURI: 'pic-w',
            updatedAt: '2024-01-01T00:00:00Z',
          },
        ] as RelatorioSyncInfo[],
      };

      relatorioService.findMany.mockResolvedValue([{ id: 'rel-w' }]);
      // both missing
      fileService.findMissingFiles.mockResolvedValue(['sig-w', 'pic-w']);

      const existingOutdated = { id: 'rel-w', assinaturaURI: 'sig-w' };
      const syncInfo = mockSyncInfo({
        outdatedOnServer: [existingOutdated],
        // server newer and has a different assinatura but same picture
        outdatedOnClient: [
          { id: 'rel-w', assinaturaURI: 'sig-new', pictureURI: 'pic-w' } as any,
        ],
      });
      (RelatorioDomainService.getSyncInfo as jest.Mock).mockReturnValue(
        syncInfo,
      );

      const result = await service.getRelatorioSyncData(input);
      // assinatura should not be added/overwritten (server newer + different);
      // picture should be added because it matches and is missing
      expect(result.outdatedOnServer).toEqual([
        { id: 'rel-w', pictureURI: 'pic-w' },
      ]);
    });
  });
});

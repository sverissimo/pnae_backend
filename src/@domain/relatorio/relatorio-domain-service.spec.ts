import { RelatorioDomainService } from './relatorio-domain-service';
import { RelatorioModel } from './relatorio-model';
import { RelatorioSyncInfo } from 'src/modules/@sync/dto/check-for-updates-input.dto';
import { SyncInfoResponse } from 'src/modules/@sync/dto/sync-response';

describe('RelatorioDomainService', () => {
  describe('getSyncInfo', () => {
    const relatoriosFromClient = [
      {
        id: '1',
        assinaturaURI: 'uri_1',
        pictureURI: 'uri_2',
        updatedAt: '2022-01-01T00:00:00.000Z',
      },
      {
        id: '2',
        assinaturaURI: 'uri_1',
        pictureURI: 'uri_2',
        updatedAt: '2022-01-02T00:00:00.000Z',
      },
      {
        id: '3',
        assinaturaURI: 'uri_1',
        pictureURI: 'uri_2',
        updatedAt: '2022-01-03T00:00:00.000Z',
      },
      {
        id: '5',
        assinaturaURI: 'uri_1',
        pictureURI: 'uri_2',
        updatedAt: '2022-01-03T00:00:00.000Z',
      },
      {
        id: '6',
        assinaturaURI: 'uri_1',
        pictureURI: 'uri_2',
        updatedAt: '2022-01-03T00:00:00.000Z',
      },
      {
        id: '7',
        assinaturaURI: 'uri_1',
        pictureURI: 'uri_2',
        updatedAt: undefined,
      },
      {
        id: '8',
        assinaturaURI: 'uri_3',
        pictureURI: 'uri_4',
        updatedAt: '2022-01-06T00:00:00.000Z',
      },
    ] as RelatorioSyncInfo[];

    const existingRelatorios = [
      {
        id: '1',
        assinaturaURI: 'uri_1',
        pictureURI: 'uri_2',
        updatedAt: '2022-01-01T00:00:00.000Z',
      },
      {
        id: '2',
        assinaturaURI: 'uri_1',
        pictureURI: 'uri_2',
        updatedAt: '2022-01-01T00:00:00.000Z',
      },
      {
        id: '4',
        assinaturaURI: 'uri_1',
        pictureURI: 'uri_2',
        updatedAt: '2022-01-04T00:00:00.000Z',
      },
      {
        id: '5',
        assinaturaURI: 'uri_1',
        pictureURI: 'uri_2',
        updatedAt: '2022-01-05T00:00:00.000Z',
      },
      {
        id: '6',
        assinaturaURI: 'uri_1',
        pictureURI: 'uri_2',
        updatedAt: undefined,
      },
      {
        id: '7',
        assinaturaURI: 'uri_1',
        pictureURI: 'uri_2',
        updatedAt: '2022-01-05T00:00:00.000Z',
      },
      {
        id: '8',
        assinaturaURI: 'uri_1',
        pictureURI: 'uri_2',
        updatedAt: '2022-01-05T00:00:00.000Z',
      },
    ] as RelatorioModel[];

    it('should return correct sync info', () => {
      const syncInfo: SyncInfoResponse<RelatorioModel> =
        RelatorioDomainService.getSyncInfo(
          relatoriosFromClient,
          existingRelatorios,
        );

      expect(syncInfo.upToDateIds).toEqual(['1']);

      expect(syncInfo.missingIdsOnServer).toEqual(['3']);
      expect(syncInfo.outdatedOnClient).toEqual([
        {
          id: '5',
          assinaturaURI: 'uri_1',
          pictureURI: 'uri_2',
          updatedAt: '2022-01-05T00:00:00.000Z',
        },
        {
          id: '7',
          assinaturaURI: 'uri_1',
          pictureURI: 'uri_2',
          updatedAt: '2022-01-05T00:00:00.000Z',
        },
      ]);
      expect(syncInfo.missingOnClient).toEqual([
        {
          id: '4',
          assinaturaURI: 'uri_1',
          pictureURI: 'uri_2',
          updatedAt: '2022-01-04T00:00:00.000Z',
        },
      ]);
    });

    it('pushes assinaturaURI when server is missing it but client has it (dates equal)', () => {
      const now = new Date().toISOString();

      const relatoriosFromClient = [
        {
          id: 'R1',
          updatedAt: now,
          assinaturaURI: 'sig-123',
          pictureURI: undefined,
        },
      ] as any;

      const existingRelatorios = [
        {
          id: 'R1',
          updatedAt: now,
          assinaturaURI: undefined,
          pictureURI: undefined,
        },
      ] as any;

      const result = RelatorioDomainService.getSyncInfo(
        relatoriosFromClient,
        existingRelatorios,
      );

      expect(result.outdatedOnServer).toEqual([
        { id: 'R1', assinaturaURI: 'sig-123' },
      ]);
      expect(result.upToDateIds).toEqual([]); // should not be up-to-date because we must sync the URI
      expect(result.outdatedOnClient).toEqual([]);
    });

    it('pushes pictureURI when server is missing it but client has it even if server is newer', () => {
      const clientTime = new Date('2025-01-01T10:00:00Z').toISOString();
      const serverTime = new Date('2025-01-02T10:00:00Z').toISOString(); // server newer

      const relatoriosFromClient = [
        { id: 'R2', updatedAt: clientTime, pictureURI: 'pic-999' },
      ] as any;

      const existingRelatorios = [
        {
          id: 'R2',
          updatedAt: serverTime,
          pictureURI: undefined,
          assinaturaURI: undefined,
        },
      ] as any;

      const result = RelatorioDomainService.getSyncInfo(
        relatoriosFromClient,
        existingRelatorios,
      );

      // URI rule wins regardless of date comparison
      expect(result.outdatedOnServer).toEqual([
        { id: 'R2', pictureURI: 'pic-999' },
      ]);
      expect(result.outdatedOnClient).toEqual([]); // not flagged as client-outdated due to URI-first rule
      expect(result.upToDateIds).toEqual([]);
    });

    it('pushes both assinaturaURI and pictureURI when both are missing on server and present on client', () => {
      const now = new Date().toISOString();

      const relatoriosFromClient = [
        {
          id: 'R3',
          updatedAt: now,
          assinaturaURI: 'sig-A',
          pictureURI: 'pic-A',
        },
      ] as any;

      const existingRelatorios = [
        {
          id: 'R3',
          updatedAt: now,
          assinaturaURI: undefined,
          pictureURI: undefined,
        },
      ] as any;

      const result = RelatorioDomainService.getSyncInfo(
        relatoriosFromClient,
        existingRelatorios,
      );

      expect(result.outdatedOnServer).toEqual([
        { id: 'R3', assinaturaURI: 'sig-A', pictureURI: 'pic-A' },
      ]);
      expect(result.upToDateIds).toEqual([]);
      expect(result.outdatedOnClient).toEqual([]);
    });

    it('does NOT push update when server already has the same URIs as client (falls through to date logic)', () => {
      const now = new Date().toISOString();

      const relatoriosFromClient = [
        {
          id: 'R4',
          updatedAt: now,
          assinaturaURI: 'sig-X',
          pictureURI: 'pic-X',
        },
      ] as any;

      const existingRelatorios = [
        {
          id: 'R4',
          updatedAt: now,
          assinaturaURI: 'sig-X',
          pictureURI: 'pic-X',
        },
      ] as any;

      const result = RelatorioDomainService.getSyncInfo(
        relatoriosFromClient,
        existingRelatorios,
      );

      expect(result.outdatedOnServer).toEqual([]); // no URI-driven update
      expect(result.upToDateIds).toEqual(['R4']); // dates equal → up-to-date
      expect(result.outdatedOnClient).toEqual([]);
    });

    it('should return both assinaturaURI and pictureURI props if both images are updated on client', () => {
      const syncInfo: SyncInfoResponse<RelatorioModel> =
        RelatorioDomainService.getSyncInfo(
          relatoriosFromClient,
          existingRelatorios,
        );
      console.log('🚀 - syncInfo.outdatedOnServer:', syncInfo.outdatedOnServer);

      expect(syncInfo.outdatedOnServer).toEqual([
        { id: '2' },
        { id: '6' },
        {
          id: '8',
          assinaturaURI: 'uri_3',
          pictureURI: 'uri_4',
        },
      ]);
    });

    it('should return only assinaturaURI in props if its the only  updated on client', () => {
      const clientRelatorios = [...relatoriosFromClient];
      clientRelatorios.pop();
      clientRelatorios.push({
        id: '8',
        assinaturaURI: 'uri_3',
        pictureURI: 'uri_2',
        updatedAt: '2022-01-06T00:00:00.000Z',
      });
      const syncInfo: SyncInfoResponse<RelatorioModel> =
        RelatorioDomainService.getSyncInfo(
          clientRelatorios,
          existingRelatorios,
        );
      expect(syncInfo.outdatedOnServer).toEqual([
        { id: '2' },
        { id: '6' },
        {
          id: '8',
          assinaturaURI: 'uri_3',
        },
      ]);
    });

    it('should return correct sync info when no relatorios on client', () => {
      const syncInfo = RelatorioDomainService.getSyncInfo(
        [],
        existingRelatorios,
      );
      expect(syncInfo.missingOnClient).toEqual(existingRelatorios);
    });
    it('should return correct sync info when no relatorios on server', () => {
      const syncInfo = RelatorioDomainService.getSyncInfo(
        relatoriosFromClient,
        [],
      );
      expect(syncInfo.missingIdsOnServer).toEqual([
        '1',
        '2',
        '3',
        '5',
        '6',
        '7',
        '8',
      ]);
    });
    it('should return correct sync info when no relatorios on server and client', () => {
      const syncInfo = RelatorioDomainService.getSyncInfo([], []);
      expect(syncInfo.missingIdsOnServer).toEqual([]);
      expect(syncInfo.missingOnClient).toEqual([]);
      expect(syncInfo.outdatedOnServer).toEqual([]);
      expect(syncInfo.outdatedOnClient).toEqual([]);
      expect(syncInfo.upToDateIds).toEqual([]);
    });
  });
});

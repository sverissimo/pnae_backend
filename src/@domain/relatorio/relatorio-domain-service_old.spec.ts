import { RelatorioDomainService } from './relatorio-domain-service';
import { RelatorioModel } from './relatorio-model';
import { RelatorioSyncInfo } from 'src/modules/@sync/dto/check-for-updates-input.dto';
import { SyncInfoResponse } from 'src/modules/@sync/dto/sync-response';
import { brToUTCTimezone } from 'src/utils/dateUtils';

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

      // With the service converting server timestamps to UTC via brToUTCTimezone,
      // the equality/diff decisions changed. Build expected values accordingly.

      // id '1' is considered server-newer (server updatedAt shifts by timezone), so it should be pushed to client:
      const serverIso_1 = brToUTCTimezone(
        '2022-01-01T00:00:00.000Z',
      ).toISOString();
      const serverIso_5 = brToUTCTimezone(
        '2022-01-05T00:00:00.000Z',
      ).toISOString();
      const serverIso_7 = brToUTCTimezone(
        '2022-01-05T00:00:00.000Z',
      ).toISOString();

      expect(syncInfo.upToDateIds).toEqual([]); // no longer '1' due to conversion -> server considered newer

      expect(syncInfo.missingIdsOnServer).toEqual(['3']);

      // server wins for ids 1,5,7 (converted timestamps). client had newer for 2,6,8 (URIs differences produce server-side updates)
      expect(syncInfo.outdatedOnClient).toEqual([
        { id: '1', updatedAt: serverIso_1 },
        { id: '5', updatedAt: serverIso_5 },
        { id: '7', updatedAt: serverIso_7 },
      ]);

      expect(syncInfo.outdatedOnServer).toEqual([
        { id: '2' },
        { id: '6' },
        {
          id: '8',
          assinaturaURI: 'uri_3',
          pictureURI: 'uri_4',
        },
      ]);

      // missingOnClient should reflect server-side converted timestamps:
      const expectedMissingOnClient = existingRelatorios
        .map((r) => ({
          ...r,
          updatedAt: r.updatedAt
            ? brToUTCTimezone(r.updatedAt).toISOString()
            : r.updatedAt,
        }))
        .filter((r) => r.id === '4'); // only id '4' is missing on client in this test

      expect(syncInfo.missingOnClient).toEqual(expectedMissingOnClient);
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

      // make server updatedAt undefined so client is considered newer and will push URI
      const existingRelatorios = [
        {
          id: 'R1',
          updatedAt: undefined,
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

    it('prioritizes server updates when server timestamp is newer', () => {
      const clientTime = '2025-01-01T10:00:00.000Z';
      const serverTime = '2025-01-02T10:00:00.000Z';
      const expectedServerIso = brToUTCTimezone(serverTime).toISOString();

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

      expect(result.outdatedOnServer).toEqual([]);
      expect(result.outdatedOnClient).toEqual([
        expect.objectContaining({
          id: 'R2',
          updatedAt: expectedServerIso,
        }),
      ]);
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

      // make server updatedAt undefined so client is considered newer and URIs will be pushed
      const existingRelatorios = [
        {
          id: 'R3',
          updatedAt: undefined,
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
          updatedAt: undefined, // invalid/undefined to force the "equal timestamps" branch
          assinaturaURI: 'sig-X',
          pictureURI: 'pic-X',
        },
      ] as any;

      const existingRelatorios = [
        {
          id: 'R4',
          updatedAt: undefined, // same invalid so they are treated as equal -> up-to-date
          assinaturaURI: 'sig-X',
          pictureURI: 'pic-X',
        },
      ] as any;

      const result = RelatorioDomainService.getSyncInfo(
        relatoriosFromClient,
        existingRelatorios,
      );

      expect(result.outdatedOnServer).toEqual([]); // no URI-driven update
      expect(result.upToDateIds).toEqual(['R4']); // equal-invalid timestamps → up-to-date
      expect(result.outdatedOnClient).toEqual([]);
    });

    it('should return both assinaturaURI and pictureURI props if both images are updated on client', () => {
      const syncInfo: SyncInfoResponse<RelatorioModel> =
        RelatorioDomainService.getSyncInfo(
          relatoriosFromClient,
          existingRelatorios,
        );

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

      // serverRelatorios are converted internally; build expected accordingly:
      const expectedMissingOnClient = existingRelatorios.map((r) => ({
        ...r,
        updatedAt: r.updatedAt
          ? brToUTCTimezone(r.updatedAt).toISOString()
          : r.updatedAt,
      }));

      expect(syncInfo.missingOnClient).toEqual(expectedMissingOnClient);
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

    it('patches client URIs when server has them and timestamps match', () => {
      const now = '2025-03-01T12:00:00.000Z';

      const relatoriosFromClient = [{ id: 'C1', updatedAt: now }] as any;

      const existingRelatorios = [
        {
          id: 'C1',
          updatedAt: now,
          assinaturaURI: 'server-sign',
          pictureURI: 'server-pic',
        },
      ] as any;

      const result = RelatorioDomainService.getSyncInfo(
        relatoriosFromClient,
        existingRelatorios,
      );

      const expectedServerIso = brToUTCTimezone(now).toISOString();

      expect(result.outdatedOnClient).toEqual([
        {
          id: 'C1',
          assinaturaURI: 'server-sign',
          pictureURI: 'server-pic',
          updatedAt: expectedServerIso,
        },
      ]);
      expect(result.outdatedOnServer).toEqual([]);
      expect(result.upToDateIds).toEqual([]);
    });

    it('keeps only changed URIs when server is newer', () => {
      const clientTime = '2024-01-01T00:00:00.000Z';
      const serverTime = '2024-01-02T00:00:00.000Z';
      const expectedServerIso = brToUTCTimezone(serverTime).toISOString();

      const relatoriosFromClient = [
        {
          id: 'S1',
          updatedAt: clientTime,
          assinaturaURI: 'sig-old',
          pictureURI: 'pic-old',
        },
      ] as any;

      const existingRelatorios = [
        {
          id: 'S1',
          updatedAt: serverTime,
          assinaturaURI: 'sig-old',
          pictureURI: 'pic-new',
        },
      ] as any;

      const result = RelatorioDomainService.getSyncInfo(
        relatoriosFromClient,
        existingRelatorios,
      );

      expect(result.outdatedOnClient).toEqual([
        {
          id: 'S1',
          updatedAt: expectedServerIso,
          pictureURI: 'pic-new',
        },
      ]);
      expect(result.outdatedOnServer).toEqual([]);
      expect(result.upToDateIds).toEqual([]);
    });

    it('treats equal timestamps with conflicting URIs as up to date', () => {
      // Force "equal/invalid" timestamps (undefined) so the equal-URI reconciliation branch runs.
      const relatoriosFromClient = [
        {
          id: 'E1',
          updatedAt: undefined,
          assinaturaURI: 'client-sign',
          pictureURI: 'client-pic',
        },
      ] as any;

      const existingRelatorios = [
        {
          id: 'E1',
          updatedAt: undefined,
          assinaturaURI: 'server-sign',
          pictureURI: 'server-pic',
        },
      ] as any;

      const result = RelatorioDomainService.getSyncInfo(
        relatoriosFromClient,
        existingRelatorios,
      );

      expect(result.outdatedOnServer).toEqual([]); // both sides have URIs but differ -> treated as "ignore" → up-to-date
      expect(result.outdatedOnClient).toEqual([]);
      expect(result.upToDateIds).toEqual(['E1']);
    });
  });
});

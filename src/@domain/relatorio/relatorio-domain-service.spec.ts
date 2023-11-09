import { RelatorioDomainService } from './relatorio-domain-service';
import { RelatorioModel } from './relatorio-model';
import { RelatorioSyncInfo } from 'src/modules/@system/dto/check-for-updates-input.dto';
import { SyncInfoResponse } from 'src/modules/@system/dto/sync-response';

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
      { id: '7', assinaturaURI: 'uri_1', pictureURI: 'uri_2', updatedAt: undefined },
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
      { id: '6', assinaturaURI: 'uri_1', pictureURI: 'uri_2', updatedAt: undefined },
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
      const syncInfo: SyncInfoResponse<RelatorioModel> = RelatorioDomainService.getSyncInfo(
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

    it('should return both assinaturaURI and pictureURI props if both images are updated on client', () => {
      const syncInfo: SyncInfoResponse<RelatorioModel> = RelatorioDomainService.getSyncInfo(
        relatoriosFromClient,
        existingRelatorios,
      );
      expect(syncInfo.outdatedOnServer).toEqual([
        { id: '2' },
        { id: '6' },
        {
          id: '8',
          assinaturaURI: true,
          pictureURI: true,
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
      const syncInfo: SyncInfoResponse<RelatorioModel> = RelatorioDomainService.getSyncInfo(
        clientRelatorios,
        existingRelatorios,
      );
      expect(syncInfo.outdatedOnServer).toEqual([
        { id: '2' },
        { id: '6' },
        {
          id: '8',
          assinaturaURI: true,
        },
      ]);
    });

    it('should return correct sync info when no relatorios on client', () => {
      const syncInfo = RelatorioDomainService.getSyncInfo([], existingRelatorios);
      expect(syncInfo.missingOnClient).toEqual(existingRelatorios);
    });
    it('should return correct sync info when no relatorios on server', () => {
      const syncInfo = RelatorioDomainService.getSyncInfo(relatoriosFromClient, []);
      expect(syncInfo.missingIdsOnServer).toEqual(['1', '2', '3', '5', '6', '7', '8']);
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

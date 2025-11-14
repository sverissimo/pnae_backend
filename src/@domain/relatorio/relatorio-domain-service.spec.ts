import { RelatorioDomainService } from './relatorio-domain-service';
import { RelatorioModel } from './relatorio-model';
import { RelatorioSyncInfo } from 'src/modules/@sync/dto/check-for-updates-input.dto';
import { SyncInfoResponse } from 'src/modules/@sync/dto/sync-response';

const addHoursISO = (iso: string, hours: number) =>
  new Date(new Date(iso).getTime() + hours * 60 * 60 * 1000).toISOString();

const byId = <T extends { id: string }>(a: T, b: T) =>
  a.id < b.id ? -1 : a.id > b.id ? 1 : 0;

const mkClient = (over: Partial<any> = {}) => ({
  id: 'X',
  assinaturaURI: 'same',
  pictureURI: 'same',
  updatedAt: '2025-01-01T00:00:00.000Z',
  ...over,
});

const mkServer = (over: Partial<any> = {}) => ({
  id: 'X',
  assinaturaURI: 'same',
  pictureURI: 'same',
  updatedAt: '2025-01-01T00:00:00.000Z',
  ...over,
});

describe('RelatorioDomainService — getSyncInfo & helpers', () => {
  describe('getSyncInfo — main matrix', () => {
    // Dataset covering: equal, client newer, server newer, only-on-client, only-on-server, invalid dates, per-URI diffs
    const relatoriosFromClient: RelatorioSyncInfo[] = [
      {
        id: '1',
        assinaturaURI: 'uri_1',
        pictureURI: 'uri_2',
        updatedAt: '2022-01-01T00:00:00.000Z',
      }, // equal to server
      {
        id: '2',
        assinaturaURI: 'uri_1',
        pictureURI: 'uri_2',
        updatedAt: '2022-01-02T00:00:00.000Z',
      }, // client newer than server
      {
        id: '3',
        assinaturaURI: 'uri_1',
        pictureURI: 'uri_2',
        updatedAt: '2022-01-03T00:00:00.000Z',
      }, // only on client
      {
        id: '5',
        assinaturaURI: 'uri_1',
        pictureURI: 'uri_2',
        updatedAt: '2022-01-03T00:00:00.000Z',
      }, // server newer than client
      {
        id: '6',
        assinaturaURI: 'uri_1',
        pictureURI: 'uri_2',
        updatedAt: '2022-01-03T00:00:00.000Z',
      }, // client newer (server invalid)
      {
        id: '7',
        assinaturaURI: 'uri_1',
        pictureURI: 'uri_2',
        updatedAt: undefined as any,
      }, // server newer (client invalid)
      {
        id: '8',
        assinaturaURI: 'uri_3',
        pictureURI: 'uri_4',
        updatedAt: '2022-01-06T00:00:00.000Z',
      }, // client newer + URIs differ
    ] as any;

    const existingRelatorios: RelatorioModel[] = [
      {
        id: '1',
        assinaturaURI: 'uri_1',
        pictureURI: 'uri_2',
        updatedAt: '2022-01-01T00:00:00.000Z',
      }, // equal
      {
        id: '2',
        assinaturaURI: 'uri_1',
        pictureURI: 'uri_2',
        updatedAt: '2022-01-01T00:00:00.000Z',
      }, // older than client
      {
        id: '4',
        assinaturaURI: 'uri_1',
        pictureURI: 'uri_2',
        updatedAt: '2022-01-04T00:00:00.000Z',
      }, // only on server
      {
        id: '5',
        assinaturaURI: 'uri_1',
        pictureURI: 'uri_2',
        updatedAt: '2022-01-05T00:00:00.000Z',
      }, // newer than client
      {
        id: '6',
        assinaturaURI: 'uri_1',
        pictureURI: 'uri_2',
        updatedAt: undefined as any,
      }, // invalid date vs valid client
      {
        id: '7',
        assinaturaURI: 'uri_1',
        pictureURI: 'uri_2',
        updatedAt: '2022-01-05T00:00:00.000Z',
      }, // newer than client (client invalid)
      {
        id: '8',
        assinaturaURI: 'uri_1',
        pictureURI: 'uri_2',
        updatedAt: '2022-01-05T00:00:00.000Z',
      }, // older than client + URIs differ
    ] as any;

    it('returns correct buckets for mixed dataset (dates, presence, and per-URI)', () => {
      const syncInfo: SyncInfoResponse<RelatorioModel> =
        RelatorioDomainService.getSyncInfo(
          relatoriosFromClient,
          existingRelatorios,
        );

      // equal timestamp no longer applies after server normalization (+3h) → none up-to-date
      expect(syncInfo.upToDateIds.sort()).toEqual([]);

      // present on client only → IDs in missingIdsOnServer
      expect(syncInfo.missingIdsOnServer.sort()).toEqual(['3']);

      // present on server only → full objects returned to client (server was normalized +3h)
      const expectedMissingOnClient = [
        {
          id: '4',
          assinaturaURI: 'uri_1',
          pictureURI: 'uri_2',
          updatedAt: addHoursISO('2022-01-04T00:00:00.000Z', 3),
        },
      ];
      expect(syncInfo.missingOnClient.sort(byId)).toEqual(
        expectedMissingOnClient.sort(byId),
      );

      // server newer now includes id '1' (due to +3h normalization), plus 5 and 7
      const expectedOutdatedOnClient = [
        { id: '1', updatedAt: addHoursISO('2022-01-01T00:00:00.000Z', 3) },
        { id: '5', updatedAt: addHoursISO('2022-01-05T00:00:00.000Z', 3) },
        { id: '7', updatedAt: addHoursISO('2022-01-05T00:00:00.000Z', 3) },
      ];
      expect(syncInfo.outdatedOnClient.sort(byId)).toEqual(
        expectedOutdatedOnClient.sort(byId),
      );

      // client newer (2,6) + per-URI diffs on 8 → sparse patches to server
      const expectedOutdatedOnServer = [
        { id: '2' },
        { id: '6' },
        { id: '8', assinaturaURI: 'uri_3', pictureURI: 'uri_4' },
      ];
      expect(syncInfo.outdatedOnServer.sort(byId)).toEqual(
        expectedOutdatedOnServer.sort(byId),
      );
    });

    it('returns all server items in missingOnClient when client has none', () => {
      const res = RelatorioDomainService.getSyncInfo([], existingRelatorios);

      // existingRelatorios are normalized to UTC (+3h) before returning
      const expected = existingRelatorios.map((r: any) => ({
        ...r,
        updatedAt: r.updatedAt ? addHoursISO(r.updatedAt, 3) : r.updatedAt,
      }));

      expect(res.missingOnClient.sort(byId)).toEqual(expected.sort(byId));
      expect(res.missingIdsOnServer).toEqual([]);
      expect(res.outdatedOnClient).toEqual([]);
      expect(res.outdatedOnServer).toEqual([]);
      expect(res.upToDateIds).toEqual([]);
    });

    it('returns all client ids in missingIdsOnServer when server has none', () => {
      const res = RelatorioDomainService.getSyncInfo(relatoriosFromClient, []);
      expect(res.missingIdsOnServer.sort()).toEqual([
        '1',
        '2',
        '3',
        '5',
        '6',
        '7',
        '8',
      ]);
      expect(res.missingOnClient).toEqual([]);
      expect(res.outdatedOnClient).toEqual([]);
      expect(res.outdatedOnServer).toEqual([]);
      expect(res.upToDateIds).toEqual([]);
    });

    it('handles empty on both sides', () => {
      const res = RelatorioDomainService.getSyncInfo([], []);
      expect(res.missingIdsOnServer).toEqual([]);
      expect(res.missingOnClient).toEqual([]);
      expect(res.outdatedOnClient).toEqual([]);
      expect(res.outdatedOnServer).toEqual([]);
      expect(res.upToDateIds).toEqual([]);
    });
  });

  describe('Equal timestamp reconciliation (gap-fill only, no churn)', () => {
    it('pushes assinaturaURI to server when missing on server and present on client (equal dates)', () => {
      const now = new Date().toISOString();
      const serverTime = addHoursISO(now, -3); // after normalization (+3h) → equals client

      const client = [
        mkClient({
          id: 'R1',
          updatedAt: now,
          assinaturaURI: 'sig-123',
          pictureURI: undefined,
        }),
      ] as any;

      const server = [
        mkServer({
          id: 'R1',
          updatedAt: serverTime,
          assinaturaURI: undefined,
          pictureURI: undefined,
        }),
      ] as any;

      const res = RelatorioDomainService.getSyncInfo(client, server);

      expect(res.outdatedOnServer.sort(byId)).toEqual([
        { id: 'R1', assinaturaURI: 'sig-123' },
      ]);
      expect(res.outdatedOnClient).toEqual([]);
      expect(res.upToDateIds).toEqual([]); // pending gap-fill
    });

    it('pushes pictureURI to client when missing on client and present on server (equal dates)', () => {
      const now = new Date().toISOString();
      const serverTime = addHoursISO(now, -3); // after normalization (+3h) → equals client

      const client = [
        mkClient({
          id: 'R2',
          updatedAt: now,
          assinaturaURI: 'sig',
          pictureURI: undefined,
        }),
      ] as any;

      const server = [
        mkServer({
          id: 'R2',
          updatedAt: serverTime,
          assinaturaURI: 'sig',
          pictureURI: 'pic-777',
        }),
      ] as any;

      const res = RelatorioDomainService.getSyncInfo(client, server);

      // Equal timestamp path returns a URI-only patch (no updatedAt)
      expect(res.outdatedOnClient.sort(byId)).toEqual([
        { id: 'R2', pictureURI: 'pic-777' },
      ]);
      expect(res.outdatedOnServer).toEqual([]);
      expect(res.upToDateIds).toEqual([]); // pending gap-fill
    });

    it('does nothing if both sides have non-empty, but different URIs (equal dates)', () => {
      const now = new Date().toISOString();
      const serverTime = addHoursISO(now, -3); // after normalization (+3h) → equals client

      const client = [
        mkClient({
          id: 'R3',
          updatedAt: now,
          assinaturaURI: 'sig-A',
          pictureURI: 'pic-A',
        }),
      ] as any;

      const server = [
        mkServer({
          id: 'R3',
          updatedAt: serverTime,
          assinaturaURI: 'sig-B',
          pictureURI: 'pic-B',
        }),
      ] as any;

      const res = RelatorioDomainService.getSyncInfo(client, server);

      expect(res.outdatedOnServer).toEqual([]);
      expect(res.outdatedOnClient).toEqual([]);
      expect(res.upToDateIds).toEqual(['R3']);
    });
  });

  describe('Server newer → send full object to client but strip unchanged URIs', () => {
    it('strips identical URIs; keeps different URIs to overwrite client', () => {
      const serverTime = '2025-02-02T10:00:00.000Z';
      const clientTime = '2025-02-01T10:00:00.000Z';
      const normalized = addHoursISO(serverTime, 3); // server returns UTC-3 → normalize +3h

      const client = [
        mkClient({
          id: 'R4',
          updatedAt: clientTime,
          assinaturaURI: 'same',
          pictureURI: 'same',
        }),
        mkClient({
          id: 'R5',
          updatedAt: clientTime,
          assinaturaURI: 'old-sig',
          pictureURI: 'old-pic',
        }),
      ] as any;

      const server = [
        mkServer({
          id: 'R4',
          updatedAt: serverTime,
          assinaturaURI: 'same',
          pictureURI: 'same',
        }), // equal URIs → strip
        mkServer({
          id: 'R5',
          updatedAt: serverTime,
          assinaturaURI: 'new-sig',
          pictureURI: 'new-pic',
        }), // different URIs → keep
      ] as any;

      const res = RelatorioDomainService.getSyncInfo(client, server);

      const expected = [
        { id: 'R4', updatedAt: normalized }, // URIs stripped
        {
          id: 'R5',
          assinaturaURI: 'new-sig',
          pictureURI: 'new-pic',
          updatedAt: normalized,
        }, // URIs kept
      ];

      expect(res.outdatedOnClient.sort(byId)).toEqual(expected.sort(byId));
      expect(res.outdatedOnServer).toEqual([]);
    });

    it('does not propagate null/empty URIs from server to client (prevents unintended deletion)', () => {
      const serverTime = '2025-02-02T10:00:00.000Z';
      const normalized = addHoursISO(serverTime, 3);
      const clientTime = '2025-02-01T10:00:00.000Z';

      const client = [
        mkClient({
          id: 'R6',
          updatedAt: clientTime,
          assinaturaURI: 'sigC',
          pictureURI: 'picC',
        }),
      ] as any;

      const server = [
        mkServer({
          id: 'R6',
          updatedAt: serverTime,
          assinaturaURI: null,
          pictureURI: '',
        }),
      ] as any;

      const res = RelatorioDomainService.getSyncInfo(client, server);

      // URIs vazias/nulas não devem ser enviadas para o cliente mesmo que o servidor seja mais novo.
      expect(res.outdatedOnClient).toEqual([
        { id: 'R6', updatedAt: normalized },
      ]);
      expect(res.outdatedOnServer).toEqual([]);
    });

    it('does not propagate null/empty URIs from client to server (prevents unintended deletion)', () => {
      const clientTime = '2025-02-02T10:00:00.000Z';
      const serverTime = '2025-02-01T10:00:00.000Z';

      const client = [
        mkClient({
          id: 'R6',
          updatedAt: clientTime,
          assinaturaURI: null,
          pictureURI: '',
          assunto: 'Some text change',
        }),
      ] as any;

      const server = [
        mkServer({
          id: 'R6',
          updatedAt: serverTime,
          assinaturaURI: 'sigC',
          pictureURI: 'picC',
          assunto: 'Some old text',
        }),
      ] as any;

      const res = RelatorioDomainService.getSyncInfo(client, server);

      // URIs vazias/nulas não devem ser requisitadas para o cliente mesmo que ele seja mais novo.
      expect(res.outdatedOnClient).toEqual([]);
      expect(res.outdatedOnServer).toEqual([{ id: 'R6' }]);
    });
  });

  describe('Client newer → sparse patch to server with per-URI selectivity', () => {
    it('sends only id when URIs are unchanged; includes changed URIs selectively', () => {
      const clientTime = '2025-03-02T10:00:00.000Z';
      const serverTime = '2025-03-01T10:00:00.000Z';

      const client = [
        mkClient({
          id: 'R6',
          updatedAt: clientTime,
          assinaturaURI: 'same',
          pictureURI: 'same',
        }), // text-only change
        mkClient({
          id: 'R7',
          updatedAt: clientTime,
          assinaturaURI: 'new-sig',
          pictureURI: 'same',
        }), // only assinatura changes
        mkClient({
          id: 'R8',
          updatedAt: clientTime,
          assinaturaURI: 'same',
          pictureURI: 'new-pic',
        }), // only picture changes
        mkClient({
          id: 'R9',
          updatedAt: clientTime,
          assinaturaURI: 'a',
          pictureURI: 'b',
        }), // both change
      ] as any;

      const server = [
        mkServer({
          id: 'R6',
          updatedAt: serverTime,
          assinaturaURI: 'same',
          pictureURI: 'same',
        }),
        mkServer({
          id: 'R7',
          updatedAt: serverTime,
          assinaturaURI: 'old-sig',
          pictureURI: 'same',
        }),
        mkServer({
          id: 'R8',
          updatedAt: serverTime,
          assinaturaURI: 'same',
          pictureURI: 'old-pic',
        }),
        mkServer({
          id: 'R9',
          updatedAt: serverTime,
          assinaturaURI: 'x',
          pictureURI: 'y',
        }),
      ] as any;

      const res = RelatorioDomainService.getSyncInfo(client, server);

      const expected = [
        { id: 'R6' },
        { id: 'R7', assinaturaURI: 'new-sig' },
        { id: 'R8', pictureURI: 'new-pic' },
        { id: 'R9', assinaturaURI: 'a', pictureURI: 'b' },
      ];

      expect(res.outdatedOnServer.sort(byId)).toEqual(expected.sort(byId));
      expect(res.outdatedOnClient).toEqual([]);
    });
  });

  describe('Helper: isNewerThan (edge combos)', () => {
    const isNewerThan = (RelatorioDomainService as any)['isNewerThan'] as (
      a?: { updatedAt?: string | Date | null },
      b?: { updatedAt?: string | Date | null },
    ) => boolean;

    it('returns true when both valid dates and a > b', () => {
      expect(
        isNewerThan(
          { updatedAt: '2025-01-02T00:00:00.000Z' },
          { updatedAt: '2025-01-01T00:00:00.000Z' },
        ),
      ).toBe(true);
    });

    it('returns false when both valid dates and a <= b', () => {
      expect(
        isNewerThan(
          { updatedAt: '2025-01-01T00:00:00.000Z' },
          { updatedAt: '2025-01-01T00:00:00.000Z' },
        ),
      ).toBe(false);
      expect(
        isNewerThan(
          { updatedAt: '2025-01-01T00:00:00.000Z' },
          { updatedAt: '2025-01-02T00:00:00.000Z' },
        ),
      ).toBe(false);
    });

    it('returns true when a is valid and b is invalid/undefined/null', () => {
      expect(
        isNewerThan(
          { updatedAt: '2025-01-01T00:00:00.000Z' },
          { updatedAt: undefined },
        ),
      ).toBe(true);
      expect(
        isNewerThan(
          { updatedAt: '2025-01-01T00:00:00.000Z' },
          { updatedAt: null },
        ),
      ).toBe(true);
    });

    it('returns false when a is invalid and b is valid', () => {
      expect(
        isNewerThan(
          { updatedAt: undefined },
          { updatedAt: '2025-01-01T00:00:00.000Z' },
        ),
      ).toBe(false);
    });

    it('returns false when both invalid', () => {
      expect(
        isNewerThan({ updatedAt: undefined }, { updatedAt: undefined }),
      ).toBe(false);
    });
  });

  describe('Helper: injectURIsIfNeeded', () => {
    const injectURIsIfNeeded = (RelatorioDomainService as any)[
      'injectURIsIfNeeded'
    ] as (
      target: Partial<RelatorioModel>,
      newer: { assinaturaURI?: string; pictureURI?: string },
      older: { assinaturaURI?: string; pictureURI?: string },
    ) => void;

    it('injects only changed URIs from newer into target', () => {
      const target: any = { id: 'X' };
      injectURIsIfNeeded(
        target,
        { assinaturaURI: 'a', pictureURI: 'p2' },
        { assinaturaURI: 'a', pictureURI: 'p1' },
      );
      expect(target).toEqual({ id: 'X', pictureURI: 'p2' });
    });

    it('does nothing when URIs are identical or missing', () => {
      const target: any = { id: 'X' };
      injectURIsIfNeeded(
        target,
        { assinaturaURI: 'a', pictureURI: 'b' },
        { assinaturaURI: 'a', pictureURI: 'b' },
      );
      expect(target).toEqual({ id: 'X' });
    });
  });

  describe('Helper: stripUnchangedUris (via serverNewer branch behavior)', () => {
    it('removes assinaturaURI/pictureURI when equal to client, keeps when different', () => {
      const serverTime = '2026-06-02T10:00:00.000Z';
      const normalized = addHoursISO(serverTime, 3);
      const clientTime = '2026-06-01T10:00:00.000Z';

      const client = [
        mkClient({
          id: 'S1',
          updatedAt: clientTime,
          assinaturaURI: 'same',
          pictureURI: 'same',
        }),
        mkClient({
          id: 'S2',
          updatedAt: clientTime,
          assinaturaURI: 'old',
          pictureURI: 'old',
        }),
      ] as any;

      const server = [
        mkServer({
          id: 'S1',
          updatedAt: serverTime,
          assinaturaURI: 'same',
          pictureURI: 'same',
        }), // equal → strip
        mkServer({
          id: 'S2',
          updatedAt: serverTime,
          assinaturaURI: 'new',
          pictureURI: 'new',
        }), // different → keep
      ] as any;

      const res = RelatorioDomainService.getSyncInfo(client, server);
      const expected = [
        { id: 'S1', updatedAt: normalized },
        {
          id: 'S2',
          assinaturaURI: 'new',
          pictureURI: 'new',
          updatedAt: normalized,
        },
      ];
      expect(res.outdatedOnClient.sort(byId)).toEqual(expected.sort(byId));
    });
  });

  describe('Helper: reconcileUrisOnEqual (gap-fill logic only)', () => {
    const reconcile = (RelatorioDomainService as any)[
      'reconcileUrisOnEqual'
    ] as (
      serverRelatorio: {
        id: string;
        assinaturaURI?: string;
        pictureURI?: string;
      },
      clientRelatorio: {
        id: string;
        assinaturaURI?: string;
        pictureURI?: string;
      },
    ) => {
      serverUriPatch: Partial<RelatorioModel>;
      clientUriPatch: Partial<RelatorioModel>;
    };

    it('fills missing URIs on the missing side only', () => {
      const { serverUriPatch, clientUriPatch } = reconcile(
        { id: 'Z1', assinaturaURI: undefined, pictureURI: 'picS' },
        { id: 'Z1', assinaturaURI: 'sigC', pictureURI: undefined },
      );

      expect(serverUriPatch).toEqual({ id: 'Z1', assinaturaURI: 'sigC' });
      expect(clientUriPatch).toEqual({ id: 'Z1', pictureURI: 'picS' });
    });

    it('does nothing when both sides have non-empty but different URIs', () => {
      const { serverUriPatch, clientUriPatch } = reconcile(
        { id: 'Z2', assinaturaURI: 'sigS', pictureURI: 'picS' },
        { id: 'Z2', assinaturaURI: 'sigC', pictureURI: 'picC' },
      );
      expect(serverUriPatch).toEqual({ id: 'Z2' });
      expect(clientUriPatch).toEqual({ id: 'Z2' });
    });

    it('does nothing when both sides already contain identical URIs', () => {
      const { serverUriPatch, clientUriPatch } = reconcile(
        { id: 'Z3', assinaturaURI: 'sig', pictureURI: 'pic' },
        { id: 'Z3', assinaturaURI: 'sig', pictureURI: 'pic' },
      );
      expect(serverUriPatch).toEqual({ id: 'Z3' });
      expect(clientUriPatch).toEqual({ id: 'Z3' });
    });

    it('treats both invalid timestamps with identical URIs as up-to-date (no patches)', () => {
      const client = [mkClient({ id: 'INV1', updatedAt: undefined })] as any;
      const server = [mkServer({ id: 'INV1', updatedAt: undefined })] as any;
      const res = RelatorioDomainService.getSyncInfo(client, server);
      expect(res.upToDateIds).toEqual(['INV1']);
      expect(res.outdatedOnServer).toEqual([]);
      expect(res.outdatedOnClient).toEqual([]);
    });

    it('treats both invalid timestamps with differing URIs as up-to-date (diff ignored)', () => {
      const client = [
        mkClient({
          id: 'INV2',
          updatedAt: undefined,
          assinaturaURI: 'a',
          pictureURI: 'b',
        }),
      ] as any;
      const server = [
        mkServer({
          id: 'INV2',
          updatedAt: undefined,
          assinaturaURI: 'c',
          pictureURI: 'd',
        }),
      ] as any;
      const res = RelatorioDomainService.getSyncInfo(client, server);
      expect(res.upToDateIds).toEqual(['INV2']);
      expect(res.outdatedOnServer).toEqual([]);
      expect(res.outdatedOnClient).toEqual([]);
    });
  });
});

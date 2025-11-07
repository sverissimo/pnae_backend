import { RelatorioSyncInfo } from 'src/modules/@sync/dto/check-for-updates-input.dto';
import { RelatorioModel } from './relatorio-model';
import { SyncInfoResponse } from 'src/modules/@sync/dto/sync-response';
import { AtendimentoUpdate } from './types/atendimento-updates';
import { ProdutorFindManyOutputDTO } from 'src/modules/produtor/types/produtores.output-dto';
import { brToUTCTimezone } from 'src/utils/dateUtils';

export class RelatorioDomainService {
  static getSyncInfo(
    relatoriosFromClient: RelatorioSyncInfo[],
    existingRelatorios: RelatorioModel[],
  ) {
    const syncInfo: SyncInfoResponse<RelatorioModel> = {
      upToDateIds: [],
      outdatedOnServer: [],
      missingIdsOnServer: [],
      outdatedOnClient: [],
      missingOnClient: [],
    };

    const serverRelatorios = (existingRelatorios || []).map((r) => ({
      ...r,
      updatedAt: r.updatedAt
        ? brToUTCTimezone(r.updatedAt).toISOString()
        : r.updatedAt,
    }));

    const clientIds = new Set(relatoriosFromClient.map((r) => r.id));
    const serverIds = new Set(serverRelatorios.map((r) => r.id));

    syncInfo.missingOnClient = serverRelatorios.filter(
      (r) => !clientIds.has(r.id),
    );
    syncInfo.missingIdsOnServer = relatoriosFromClient
      .filter((r) => !serverIds.has(r.id))
      .map((r) => r.id);

    const clientMap = new Map(relatoriosFromClient.map((r) => [r.id, r]));

    for (const serverRelatorio of serverRelatorios) {
      const clientRelatorio = clientMap.get(serverRelatorio.id);

      if (!clientRelatorio) {
        continue;
      }

      const clientNewer = this.isNewerThan(clientRelatorio, serverRelatorio);
      const serverNewer = this.isNewerThan(serverRelatorio, clientRelatorio);

      if (clientNewer) {
        const serverUpdate: Partial<RelatorioModel> = {
          id: clientRelatorio.id,
        };

        this.injectURIsIfNeeded(serverUpdate, clientRelatorio, serverRelatorio);
        syncInfo.outdatedOnServer.push(serverUpdate);
        continue;
      }

      if (serverNewer) {
        this.stripUnchangedUris(serverRelatorio, clientRelatorio);
        syncInfo.outdatedOnClient.push(serverRelatorio);
        continue;
      }

      // - If one side is missing a URI and the other has it => copy to the missing side.
      const { serverUriPatch, clientUriPatch } = this.reconcileUrisOnEqual(
        serverRelatorio,
        clientRelatorio,
      );

      if (Object.keys(serverUriPatch).length > 1) {
        // has id + at least one URI
        syncInfo.outdatedOnServer.push(serverUriPatch);
        continue;
      }
      if (Object.keys(clientUriPatch).length > 1) {
        // has id + at least one URI
        syncInfo.outdatedOnClient.push(clientUriPatch as RelatorioModel);
        continue;
      }

      syncInfo.upToDateIds.push(clientRelatorio.id);
    }

    return syncInfo;
  }

  private static isNewerThan(
    a?: { updatedAt?: string | Date | null },
    b?: { updatedAt?: string | Date | null },
  ): boolean {
    const aMs = a?.updatedAt ? Date.parse(a.updatedAt as any) : NaN;
    const bMs = b?.updatedAt ? Date.parse(b.updatedAt as any) : NaN;
    const aValid = !Number.isNaN(aMs);
    const bValid = !Number.isNaN(bMs);
    if (aValid && bValid) return aMs > bMs;
    if (aValid && !bValid) return true;
    return false;
  }

  /**
   * Inject URIs from "newer" into "target" only if they are present and different from "older".
   * Used when we want the client to upload only the changed files back to the server.
   */
  private static injectURIsIfNeeded(
    target: Partial<RelatorioModel>,
    newer: { assinaturaURI?: string; pictureURI?: string },
    older: { assinaturaURI?: string; pictureURI?: string },
  ): void {
    if (newer.assinaturaURI && newer.assinaturaURI !== older.assinaturaURI) {
      (target as any).assinaturaURI = newer.assinaturaURI;
    }
    if (newer.pictureURI && newer.pictureURI !== older.pictureURI) {
      (target as any).pictureURI = newer.pictureURI;
    }
  }

  /**
   * When server is newer and we push the full object to the client,
   * remove URI fields that are identical to the client's copy to avoid unnecessary overwrites.
   */
  private static stripUnchangedUris(
    clientUpdate: Partial<RelatorioModel>,
    clientRelatorio: { assinaturaURI?: string; pictureURI?: string },
  ): void {
    if (clientUpdate.assinaturaURI === clientRelatorio.assinaturaURI) {
      delete (clientUpdate as any).assinaturaURI;
    }
    if (clientUpdate.pictureURI === clientRelatorio.pictureURI) {
      delete (clientUpdate as any).pictureURI;
    }
  }

  /**
   * Equal timestamps reconciliation:
   * - If server is missing a URI but client has it -> patch server.
   * - If client is missing a URI but server has it -> patch client.
   * - If both have URIs and they differ -> ignore (do nothing).
   */
  private static reconcileUrisOnEqual(
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
  ): {
    serverUriPatch: Partial<RelatorioModel>;
    clientUriPatch: Partial<RelatorioModel>;
  } {
    const serverUriPatch: Partial<RelatorioModel> = { id: clientRelatorio.id };
    const clientUriPatch: Partial<RelatorioModel> = { id: clientRelatorio.id };

    if (!serverRelatorio.assinaturaURI && clientRelatorio.assinaturaURI) {
      serverUriPatch.assinaturaURI = clientRelatorio.assinaturaURI;
    } else if (
      !clientRelatorio.assinaturaURI &&
      serverRelatorio.assinaturaURI
    ) {
      clientUriPatch.assinaturaURI = serverRelatorio.assinaturaURI;
    }
    if (!serverRelatorio.pictureURI && clientRelatorio.pictureURI) {
      serverUriPatch.pictureURI = clientRelatorio.pictureURI;
    } else if (!clientRelatorio.pictureURI && serverRelatorio.pictureURI) {
      clientUriPatch.pictureURI = serverRelatorio.pictureURI;
    }

    return { serverUriPatch, clientUriPatch };
  }

  public static updateAtendimentoIds(
    relatorios: RelatorioModel[],
    atendimentoUpdates: AtendimentoUpdate[],
  ) {
    if (!relatorios.length || !atendimentoUpdates.length) return relatorios;

    // Build prev -> next map once
    const to = RelatorioDomainService.buildMap(atendimentoUpdates);

    return relatorios.map((relatorio) => {
      const res = RelatorioDomainService.followChain(
        relatorio.atendimentoId,
        to,
      );
      if (!res) return relatorio; // no change

      const { final, predecessor } = res;
      // Only update when final actually differs from start
      if (final === relatorio.atendimentoId) return relatorio;

      return {
        ...relatorio,
        atendimentoId: final,
        atendimentoAnteriorId:
          predecessor ?? relatorio.atendimentoAnteriorId ?? null,
      };
    });
  }

  public static groupByRegionAndCity(
    relatorios: RelatorioModel[],
    produtores: ProdutorFindManyOutputDTO[],
  ) {
    // sort producers for deterministic grouping: by region, then municipio, then producer name
    produtores.sort((a, b) => {
      const r = (a.regional_sre || '').localeCompare(b.regional_sre || '');
      if (r !== 0) return r;
      const m = (a.municipio || '').localeCompare(b.municipio || '');
      if (m !== 0) return m;
      return (a.nm_pessoa || '').localeCompare(b.nm_pessoa || '');
    });

    // build a nested map: region -> municipio -> relatorios[]
    const regionMap: Record<string, Record<string, RelatorioModel[]>> = {};

    for (const p of produtores) {
      const regionKey = p.regional_sre ?? 'regional_nao_encontrada';
      const municipioKey = p.municipio ?? 'mun_nao_encontrado';

      if (!regionMap[regionKey]) regionMap[regionKey] = {};
      if (!regionMap[regionKey][municipioKey])
        regionMap[regionKey][municipioKey] = [];

      const produtorRelatorios = relatorios.filter(
        (r) => String(r.produtorId) === String(p.id_pessoa_demeter),
      );

      if (produtorRelatorios.length) {
        regionMap[regionKey][municipioKey].push(...produtorRelatorios);
      }
    }

    // convert to the array format:
    // [ { "Region A": [ { "Municipio X": [..] }, { "Municipio Y": [..] } ] }, { "Region B": [...] } ]
    const result = Object.keys(regionMap)
      .sort()
      .map((region) => {
        const municipiosMap = regionMap[region];
        const municipiosArray = Object.keys(municipiosMap)
          .sort()
          .map((municipio) => {
            return { [municipio]: municipiosMap[municipio] };
          });
        return { [region]: municipiosArray };
      });

    return result;
  }

  private static buildMap(updates: AtendimentoUpdate[]): Map<string, string> {
    const to = new Map<string, string>();
    for (const u of updates) {
      const prev = u.atendimentoAnteriorId;
      const next = u.atendimentoId;
      if (to.has(prev) && to.get(prev)! !== next) {
        console.warn(
          `[RelatorioUpdater] Conflicting mapping for ${prev}: ${to.get(
            prev,
          )} -> ${next}`,
        );
      }
      to.set(prev, next);
    }
    return to;
  }

  /**
   * Follows prev->next pointers starting at `start`,
   * returns null if no advancement occurred,
   * otherwise returns the final id and the immediate predecessor of that final id.
   */
  private static followChain(
    start: string,
    to: Map<string, string>,
  ): { final: string; predecessor?: string } | null {
    let cur = start;
    let prev: string | undefined;
    const seen = new Set<string>(); // cycle guard
    let moved = false;

    while (true) {
      const next = to.get(cur);
      if (next === undefined) break; // end of chain
      if (seen.has(next)) {
        // cycle: stop safely before stepping in again
        prev = cur; // cur points to next (the cycle entry)
        cur = next;
        moved = true;
        break;
      }
      seen.add(cur);
      prev = cur;
      cur = next;
      moved = true;
    }

    if (!moved) return null; // no update for this start
    return { final: cur, predecessor: prev }; // predecessor is the node that points to final
  }
}

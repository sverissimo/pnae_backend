import { RelatorioSyncInfo } from 'src/modules/@sync/dto/check-for-updates-input.dto';
import { RelatorioModel } from './relatorio-model';
import { SyncInfoResponse } from 'src/modules/@sync/dto/sync-response';
import { AtendimentoUpdate } from './types/atendimento-updates';
import { ProdutorFindManyOutputDTO } from 'src/modules/produtor/types/produtores.output-dto';
import { parseSyncedDates } from 'src/utils/dateUtils';

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

    const clientIds = new Set(relatoriosFromClient.map((r) => r.id));
    const serverIds = new Set(existingRelatorios.map((r) => r.id));

    syncInfo.missingOnClient = existingRelatorios.filter(
      (r) => !clientIds.has(r.id),
    );
    syncInfo.missingIdsOnServer = relatoriosFromClient
      .filter((r) => !serverIds.has(r.id))
      .map((r) => r.id);

    for (const serverRelatorio of existingRelatorios) {
      const clientRelatorio = relatoriosFromClient.find(
        (r) => r.id === serverRelatorio.id,
      );

      if (!clientRelatorio) {
        continue;
      }

      const update = { id: clientRelatorio.id } as Partial<RelatorioModel>;

      // If Server doesnt have the URIs, but Client does, update server no matter the dates
      const uriUpdates = this.checkOutdatedURIs(
        clientRelatorio,
        serverRelatorio,
      );
      if (
        (uriUpdates.assinaturaURI && !serverRelatorio.assinaturaURI) ||
        (uriUpdates.pictureURI && !serverRelatorio.pictureURI)
      ) {
        Object.assign(update, uriUpdates);
        syncInfo.outdatedOnServer.push(update);
        continue;
      }

      // Date comparison
      const { clientMs, serverMs } = parseSyncedDates(
        clientRelatorio.updatedAt,
        serverRelatorio.updatedAt,
      );

      if (clientMs < serverMs || (!clientMs && serverMs)) {
        syncInfo.outdatedOnClient.push(serverRelatorio);
        continue;
      }

      if (clientMs > serverMs || (clientMs && !serverMs)) {
        const outDatedURIs = this.checkOutdatedURIs(
          clientRelatorio,
          serverRelatorio,
        );

        if (outDatedURIs.assinaturaURI || outDatedURIs.pictureURI) {
          Object.assign(update, outDatedURIs);
        }
        syncInfo.outdatedOnServer.push(update);
        continue;
      }
      syncInfo.upToDateIds.push(clientRelatorio.id);
    }
    return syncInfo;
  }

  private static checkOutdatedURIs(
    clientRelatorio: RelatorioSyncInfo,
    serverRelatorio: RelatorioModel,
  ): Partial<RelatorioModel> {
    const updates: Partial<RelatorioModel> = {};

    if (
      clientRelatorio.assinaturaURI &&
      clientRelatorio.assinaturaURI !== serverRelatorio.assinaturaURI
    ) {
      updates.assinaturaURI = clientRelatorio.assinaturaURI;
    }
    if (
      clientRelatorio.pictureURI &&
      clientRelatorio.pictureURI !== serverRelatorio.pictureURI
    ) {
      updates.pictureURI = clientRelatorio.pictureURI;
    }
    return updates;
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

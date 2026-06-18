import { RelatorioModel } from 'src/@domain/relatorio/relatorio-model';

// Whitelist of the ONLY relatório fields the frozen mobile app can persist:
// each maps to a column in mobile's fixed-schema SQLite `relatorio` table (or to
// a key its `toLocalDTO` handles). Being a valid backend `RelatorioModel` key is
// NOT enough to belong here — e.g. `atendimentoAnteriorId` is a backend-derived
// replacement-tracking field with no mobile column, so sending it non-null makes
// mobile's INSERT fail ("no such column"). Keep this list to what mobile stores.
// See docs/mobile-endpoint-contract.md.
export const MOBILE_RELATORIO_FIELDS = [
  'id',
  'produtorId',
  'tecnicoId',
  'contratoId',
  'numeroRelatorio',
  'assunto',
  'orientacao',
  'pictureURI',
  'assinaturaURI',
  'atendimentoId',
  'outroExtensionista',
  'coordenadas',
  'readOnly',
  'createdAt',
  'updatedAt',
] as const satisfies readonly (keyof RelatorioModel)[];

/**
 * Projects a relatório down to only the fields the frozen mobile app knows.
 * Whitelist (not blacklist), so any future web-only field is dropped
 * automatically. Must be applied on EVERY mobile-facing relatório read path
 * — both sync and `GET /relatorios?produtorId=` — because mobile persists the
 * payload into a fixed-schema SQLite table, and a non-null unknown column makes
 * the INSERT fail (see docs/mobile-endpoint-contract.md).
 */
export function toMobileRelatorio(r: RelatorioModel): RelatorioModel {
  const out = {} as RelatorioModel;
  for (const k of MOBILE_RELATORIO_FIELDS) {
    if (k in r) (out as any)[k] = (r as any)[k];
  }
  return out;
}

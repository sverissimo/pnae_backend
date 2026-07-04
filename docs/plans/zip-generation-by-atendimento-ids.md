# ZIP Generation By Atendimento IDs

## Goal

Change the `/download` ZIP flow from a SEE date-range selector to a pasted list of numeric
`atendimentoId` values, while keeping the existing queue, worker, polling, ZIP history, filesystem
retention, and download mechanics.

The pasted numbers are treated as Demeter `at_atendimento.id_at_atendimento` values. This is the
stable join point for both:

- PNAE-backed relatórios stored in local Postgres (`relatorio.id_at_atendimento`);
- Demeter-only manual relatórios whose files live in `at_arquivo`.

## Keep As-Is

- Frontend route stays `/download`.
- Frontend still starts one ZIP job, polls `relatorios/zip/status/:jobId`, refreshes
  `relatorios/zip/history`, and downloads from `relatorios/zip/download/:filename`.
- Backend still uses BullMQ (`zip-generation`), `ZipWorkerService`, `RelatorioExportService`, and
  `ZipCreator`.
- Final output remains a parent ZIP containing regional ZIPs, split by the existing region-part size
  rule.
- Last 5 generated ZIP files remain available on disk through the existing history endpoint.
- Existing Demeter combined-PDF logic stays the source of truth for manual relatórios:
  `RelatorioExportService.createDemeterRelatorioPdf()` plus `assembleDemeterPdf()`.

## Flow Change

### 1. Frontend input

Replace `DateRangePicker` in `app/download/DownloadRelatoriosPage.tsx` with a textarea-like input.

Parsing rules:

```ts
const atendimentoIds = Array.from(new Set(text.match(/\d+/g) ?? []));
```

This accepts numbers pasted from an Excel column with spaces, newlines, tabs, or mixed whitespace.
The UI should show a small count preview and disable "Gerar ZIP" when the parsed list is empty or
above the 1,000-id backend cap.

Touch points:

- `app/download/DownloadRelatoriosPage.tsx`
- replace or retire `app/download/components/DateRangePicker.tsx`
- `features/download/hooks/useDownloadZip.ts`
- `features/download/types/CreateJobParams.ts`
- `features/download/types/ZipFileMetadata.ts`

Request body becomes:

```ts
{
  userId: string;
  atendimentoIds: string[];
}
```

Keep `userId` and the current allowed-user gate for the first implementation.

### 2. Backend job contract

Update `POST /relatorios/zip/create-job` to validate:

- `userId` is present and allowed;
- `atendimentoIds` is a non-empty array;
- every id is numeric;
- duplicates are removed while preserving paste order.
- the final unique-id count is capped at **1,000**. Return `400` above the cap with a clear message
  asking the user to split the paste into smaller jobs. This keeps the first pass reliable while the
  Demeter-only lookup remains per id.

Mobile compatibility check: `pnae_mobile/` has no `/relatorios/zip` or `create-job` references, so
the existing web-only endpoint can move to the new body without keeping deprecated `from/to` support.

BullMQ job data becomes:

```ts
{
  userId: string;
  atendimentoIds: string[];
}
```

`ZipWorkerService` should pass those ids into `createZipFile({ atendimentoIds })`.

Update the Redis job metadata too. `createZipJob()` currently stores `from`, `to`, `fromDate`, and
`toDate` under `zip:<jobId>`, and `getZipJobStatus()` echoes the date fields for empty jobs. Replace
that metadata with the new id-based shape, for example `atendimentoCount` and optional
`requestedAtendimentoIds` for backend diagnostics. Empty-job status should no longer expose
`fromDate` / `toDate`.

### 3. Select ZIP entries by id

Replace `findByDataSeeRange()` with a resolver that receives the requested atendimento ids.

KISS first pass:

1. Load PNAE relatórios through the existing `relatorioService.findAll({ contratoId: 2 })` path.
   This keeps the current replacement-id behavior from `updateAtendimentoIds()`.
2. Build a map by `relatorio.atendimentoId`.
3. For each requested id:
   - if a PNAE relatório exists, create a PNAE ZIP item;
   - otherwise call `atendimentoService.getAtendimentoComRelatorioDemeter(id)`;
   - if Demeter returns a manual relatório row, create a Demeter ZIP item;
   - otherwise mark the id as skipped.

Do not query `at_arquivo` directly from the PNAE backend. Demeter-only files must still come through
the existing gateway-backed `AtendimentoService.getArquivosAtendimento()` path used by
`createDemeterRelatorioPdf()`.

Suggested internal type:

```ts
type ZipRelatorioItem =
  | {
      source: 'pnae';
      atendimentoId: string;
      regional: string;
      municipio: string;
      relatorio: RelatorioModel;
    }
  | {
      source: 'demeter';
      atendimentoId: string;
      regional: string;
      municipio: string;
      demeter: AtendimentoComRelatorioDemeterDTO;
    };
```

For PNAE items, keep using `produtorService.findManyById()` to resolve regional and municipio, as the
current `getRelatoriosPorRegional()` does. For Demeter items, use the already-enriched
`nomeRegional` / `nomeMunicipio` from `getAtendimentoComRelatorioDemeter()`, falling back to stable
placeholder names when missing.

Then group the mixed item list directly by `item.regional` and `item.municipio`. Do not reuse
`RelatorioDomainService.groupByRegionAndCity()` as-is: it is intentionally typed around
`RelatorioModel[]` plus produtor rows. Either add a small ZIP-local grouping helper in
`RelatorioExportService`, or generalize the domain helper only if the resulting API stays clean for
both call sites.

### 4. Generate the correct PDF per item

Make `ZipCreator.generateRegionZipParts()` generic enough to accept `ZipRelatorioItem` instead of
only `RelatorioModel`. Its behavior should stay the same: bounded PDF creation, sequential archive
append, part splitting, temp-file cleanup.

PDF callback:

```ts
if (item.source === 'pnae') {
  return this.createPDFStream(item.relatorio.id, item.relatorio);
}

return this.createDemeterPDFFile(item.atendimentoId, item.demeter);
```

Add a small helper in `RelatorioExportService`:

- call existing `createDemeterRelatorioPdf(atendimentoId)`;
- write the returned `Buffer` to a collision-safe temp PDF path. Do not use only
  `os.tmpdir()/<atendimentoId>.pdf`; concurrent jobs can include the same id. Include the BullMQ job
  id, a random suffix, or `fs.mkdtemp()` directory in the path.
- return `{ filename, filePath }` in the same shape as `createPDFStream()`;
- use a deterministic filename that includes municipio, produtor name, atendimento id, and a
  `manual` marker.

Apply the same collision-safe temp-file rule to the existing PNAE `createPDFStream()` path while
touching this flow; it currently writes to `os.tmpdir()/<relatorioId>.pdf`, which has the same
cross-job collision risk.

No duplicated PDF assembly logic should be added to the ZIP flow. The Demeter path must reuse the
same unsupported-MIME and image/PDF behavior as `GET /relatorios/manual`.

### 5. Final ZIP name and history

Date-based filenames no longer fit. Use a timestamped name, for example:

```txt
relatorios_atendimentos_2026-07-03_153000.zip
```

Update `ZipCreator.generateFinalZip()` to accept a new `filenameSuffix` or explicit final filename.
No `from/to` fallback is needed for new jobs because the ZIP create endpoint is web-only.

Update `getZipHistory()` and the frontend `ZipFileMetadata` so old date-range files still display,
but new pasted-id files display from `createdAt` plus filename/count rather than `fromDate` and
`toDate`.

### 6. Export-date marking

After the final ZIP is created, keep the current side effect of marking atendimentos as exported.

Use the atendimento ids that actually produced a PDF. Fetch their current atendimento rows with
`atendimentoService.findMany(includedAtendimentoIds)` and pass the result to
`setAtendimentosExportDate()`. This covers both PNAE-backed and Demeter-only rows without inventing a
new gateway path.

### 7. Persist included atendimento ids in Redis

After the final/parent ZIP is created, save the array of atendimento ids that actually produced a
PDF, keyed by the generated ZIP file, in Redis. A single hash matches the requested shape
`{ [zipFile_<timestamp>]: [...atendimentoIds] }` and keeps reads one `HGETALL` away:

```txt
HSET zip:atendimentos-incluidos <finalZipFilename> '["123456","789012",...]'
```

Rules:

- Write it in `createZipFile()` right after `generateFinalZip()` succeeds, using the same
  included-ids list that feeds the export-date marking in step 6.
- No TTL, no eviction, no flush. Entries persist across jobs and outlive the on-disk ZIPs — the
  last-5-files disk cleanup never touches this hash.
- Expose it through a new web-only endpoint, e.g. `GET /relatorios/zip/atendimentos-incluidos`,
  returning `{ [zipFilename]: atendimentoIds[] }`. Document it in the backend AGENTS "Endpoints
  not used by mobile" list.
- Frontend `/download` renders it as a dead-simple static list/table — "atendimentos already
  included in previously generated ZIP files" — no pagination or interactivity in the first pass.
- Durability caveat: with no TTL the data lives as long as the Redis instance's own persistence
  (RDB/AOF) allows. If that guarantee is ever insufficient, mirror the write to a JSON file under
  `ZIP_FILES_PATH` — the currently unused `AtendimentoService.saveIdsToFile()` already sketches
  that fallback.

## Error And Empty Behavior

- If parsing finds no ids, frontend blocks the request.
- If the backend receives no valid ids, return `400`.
- If the backend receives more than 1,000 unique ids, return `400`.
- If no requested id produces a PDF, return the existing empty-job style message:
  `Não há nenhum relatório para ser anexado no SEI.`
- If one id fails during PDF generation, keep the current ZIP behavior: skip that PDF, log the error,
  and continue with the rest.
- If Demeter PDF assembly hits unsupported stored data such as `application/msword`, reuse the
  existing clear error from `createDemeterRelatorioPdf()` for that item.

## Optional Optimization, Only If Needed

The KISS implementation can call `getAtendimentoComRelatorioDemeter(id)` once per missing id. If the
Excel paste commonly contains hundreds of Demeter-only ids and this becomes slow, add an additive
gateway query later:

```graphql
atendimentosComRelatorioManualByIds(ids: [BigInt!]!): [AtendimentoListItem!]!
```

That optimization should not change the ZIP contract. It only batches the Demeter-only lookup.

## Implementation Phases

Land as one continuous sequence (the old date-range flow stops working at Phase 1, so `/download`
stays broken in dev until Phase 4). Each phase ends at a verifiable checkpoint.

### Phase 1 — Backend selection core (sections 2 + 3)

New request body and validation (numeric, dedupe, 1,000 cap), BullMQ job data and Redis job
metadata, worker pass-through, the id resolver (PNAE map → Demeter lookup → skipped), and the
mixed-source grouping helper. Highest domain risk; fully coverable by specs with no PDF/ZIP work.

**Checkpoint:** specs green; resolver provably buckets a mixed id list into PNAE / Demeter /
skipped and groups by regional/município.

### Phase 2 — PDF/ZIP pipeline (sections 4 + 5)

Genericize `ZipCreator.generateRegionZipParts()` to `ZipRelatorioItem`, add the Demeter temp-PDF
helper, collision-safe temp paths (including the existing `createPDFStream()` one), timestamped
final ZIP name, `getZipHistory()` dual-format support.

**Checkpoint:** a real job with mixed ids produces a correct parent ZIP on disk — the
UI-independent manual-acceptance items run here via a direct POST.

### Phase 3 — Side effects (sections 6 + 7)

Export-date marking from the actually-included ids, the `zip:atendimentos-incluidos` Redis hash
write, the new read endpoint, and the backend AGENTS documentation updates. Kept separate from
Phase 2 so the "after the ZIP succeeds" tail can be verified against a known ZIP run.

**Checkpoint:** after a job, `dt_export_ok` is set only for included ids, the hash holds them
keyed by the final filename, and the read endpoint returns them.

### Phase 4 — Frontend (section 1 + display changes)

Textarea input with count preview and cap handling, hook/types, `ZipFileListItem` dual display,
`DownloadNotes` text, and the "atendimentos already included" static table. Last on purpose: the
backend contract is frozen and verified, so this is mechanical.

**Checkpoint:** the full manual-acceptance list passes end-to-end from the UI.

## Test Plan

Backend unit/spec coverage:

- controller rejects missing/empty/non-numeric `atendimentoIds`;
- controller rejects more than 1,000 unique ids;
- `createZipJob()` enqueues ids and stores job metadata;
- worker passes ids into `createZipFile()`;
- resolver splits requested ids into PNAE-backed, Demeter-only, and skipped;
- mixed-source grouping buckets both PNAE and Demeter items by regional/municipio without calling
  `RelatorioDomainService.groupByRegionAndCity()` on Demeter items;
- Demeter ZIP item calls the existing combined-PDF path;
- final ZIP history supports both old date-range names and new id-paste names;
- included atendimento ids are persisted to the Redis hash after the final ZIP, with no TTL, and
  the new read endpoint returns them keyed by ZIP filename.

Frontend tests or manual checks:

- paste Excel column values separated by spaces, tabs, and newlines;
- duplicate numbers are counted once;
- a paste above 1,000 unique ids shows the backend validation error cleanly;
- empty paste disables "Gerar ZIP";
- polling and completed download link behave unchanged.

Manual acceptance:

- one PNAE-backed atendimento id;
- one Demeter-only manual atendimento id;
- mixed PNAE + Demeter ids in one ZIP;
- one invalid/missing id mixed with valid ids;
- all invalid ids returns the empty-job message;
- last 5 ZIP history still works after generating more than 5 files.

## Files Expected To Change

Backend:

- `src/modules/relatorios/relatorios.controller.ts`
- `src/modules/relatorios/dto/zip-job.dtos.ts`
- `src/modules/relatorios/workers/zip.worker.service.ts`
- `src/modules/relatorios/relatorios.export.service.ts`
- `src/@zip-gen/ZipCreator.ts`
- backend AGENTS "Endpoints not used by mobile" list, for the new included-atendimentos read
  endpoint and the clarified web-only ZIP create-job body
- focused specs beside the changed files

Frontend:

- `web_interface/app/download/DownloadRelatoriosPage.tsx`
- `web_interface/app/download/components/DownloadNotes.tsx`
- `web_interface/app/download/components/*` for the new textarea input
- `web_interface/features/download/hooks/useDownloadZip.ts`
- `web_interface/features/download/types/*`
- `web_interface/app/download/components/ZipFileListItem.tsx`
- new small component for the "atendimentos already included" static table

Gateway:

- no change for the first pass.
- add only the optional batch-by-ids query if real usage shows the per-id lookup is too slow.

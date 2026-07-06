# ZIP eligibility filter + "não adicionados" tracking

Brief plan. Backend: an export-eligibility gate, a new Redis record of what was left out, and limit/rotation tweaks. Frontend: show "não adicionados", handle large (2–3k) id lists, compact Excel-paste, and a non-blocking "already exported" helper on the input. **Caching is out of scope** — do not touch the hydration-cache discussion here.

## Goal

1. The ZIP must only include atendimentos that are **active and SEE-approved** (`ativo === true && !!data_see`). Everything else is filtered out.
2. **Whenever a ZIP is produced**, every requested id that did **not** make it in — filtered out, errored, or unresolved — is persisted to a new Redis key (keyed by the produced ZIP filename) so the download page can show it. When **no** ZIP is produced at all, there is no filename to key on, so nothing is recorded and the job status carries the outcome instead (see the Part B edge cases).
3. The download-page history shows both "adicionados" and "não adicionados" per ZIP, in a layout that stays usable at ~2–3k ids each.
4. Keep only the **2** most recent ZIPs on disk (rotate); raise the per-ZIP id cap **1,000 → 4,000**.
5. The id input takes Excel-column paste compactly and shows a **non-blocking** warning for ids already exported in previous ZIPs (duplicates stay allowed).

---

## Part A — Eligibility filter (backend)

**Rule:** include a requested id **iff** its `at_atendimento` row has `ativo === true` **and** a truthy `data_see`. Exclude if either fails (SEE = the final approval; inactive = superseded). `data_see` is a date column, so the test is presence (`!!data_see`). Note: `data_see` (SEE), not `data_sei` (DETEC).

**Where:** in `resolveZipItems` ([src/modules/relatorios/relatorios.export.service.ts](../../src/modules/relatorios/relatorios.export.service.ts)) — the single point where the PNAE and Demeter branches converge. **Not** in the gateway lookups: `findOneComRelatorioDemeter` is shared with the read endpoints (`GET /atendimento/com-relatorio-demeter/:id` and the paginated list) which must keep returning every atendimento. The filter is ZIP-policy, not a global atendimento filter.

**Field sourcing (the asymmetry):** the Demeter DTO already carries `ativo` + `data_see`, but the PNAE `RelatorioModel` (from `findAll({ contratoId: 2 })`, no expand) carries **neither** — those live on the external `AtendimentoModel`. Since every pasted id is an `at_atendimento` PK, source the gate uniformly:

- Up front, build `atendimentoMap` from `atendimentoService.findMany(atendimentoIds)` → `AtendimentoModel[]` (already exposes `ativo` + `data_see`; same call the sibling `persistZipSideEffects` already uses — one batched `IN` on the PK, fine at the 4,000-id cap — see the Part D load note).
- Gate **before** resolution: only ids whose map row passes proceed to the PNAE/Demeter resolution. Ineligible ids never trigger a produtor fetch or Demeter hydration, and — because they never enter `includedAtendimentoIds` — `setAtendimentosExportDate` never stamps `dt_export_ok` on a non-approved atendimento. Correct by construction.

---

## Part B — "Não adicionados" persistence (backend)

**What to record:** `naoAdicionados = requested − includedAtendimentoIds`. This single diff unifies every reason an id didn't make the ZIP — **ineligible** (Part A), **errored** (PDF/region failure, already excluded from `includedAtendimentoIds`), and **unresolved** (the existing `skippedIds`, no relatório on either side). One flat bucket, exactly as requested; no need to thread three separate lists.

**Storage:** new Redis hash, mirroring the existing included hash:

- Constant `ZIP_ATENDIMENTOS_NAO_INCLUIDOS_KEY = 'zip:atendimentos-nao-incluidos'` in `dto/zip-job.dtos.ts`.
- Shape `{ [finalZipFilename]: atendimentoId[] }`, **no TTL** (same persistence contract as `zip:atendimentos-incluidos` — outlives the 2-file disk rotation of Part D; also feeds the Part E input helper).
- Written in `persistZipSideEffects` alongside the included `hset` (pass `atendimentoIds` in so it can diff), **log-and-continue on failure** — the ZIP is already on disk.

**Read (frontend-facing):** add a sibling endpoint mirroring the existing one — `GET /relatorios/zip/atendimentos-nao-incluidos` → `getAtendimentosNaoIncluidos()` → `Record<filename, ids[]>`. This leaves the current `atendimentos-incluidos` endpoint and its consumer untouched (lowest risk, pure mirror). Both live under the `/relatorios/zip` auth-bypass prefix like the sibling. *Alt if a single round-trip is preferred:* extend the existing endpoint to `{ incluidos, naoIncluidos }` — but that changes its response shape.

**Edge — no ZIP filename to key on (two cases, both leave the hash untouched):**

1. **All ids ineligible/unresolved** → `items` is empty → `createZipFile` returns the existing "Não há nenhum relatório…" message; job status surfaces `empty`.
2. **All PDF generation fails** → `items` existed and passed the gate, but every region errors so `filePaths` is empty → `createZipFile` **throws** ("Falha ao gerar os PDFs…") **before** `persistZipSideEffects`; job status surfaces `failed`.

In both, no final ZIP exists, so the "não adicionados" hash records nothing — the filename-keyed model can't. This is the accepted limitation of the requirement (#2 is satisfied only when a ZIP is produced, which is also the only case with a history row to attach it to). The per-id detail for a total failure is not recoverable from the hash; the job's `failed`/`empty` status is the signal. Leave as-is (KISS) — keying not-added by `jobId` for the no-file case would diverge from the filename-keyed frontend model for a rare path.

---

## Part C — Frontend: history display (big-list handling)

Files: `web_interface/app/download/components/IncludedAtendimentosTable.tsx`, `features/download/hooks/useDownloadZip.ts`, `features/download/types/ZipFileMetadata.ts`.

**The page already has two separate sections** ([DownloadRelatoriosPage.tsx](../../../web_interface/app/download/DownloadRelatoriosPage.tsx)): **"Últimos Arquivos ZIP"** (downloads, `ZipFileListItem` over `zipFilesHistory`) and **"Atendimentos já incluídos…"** (the id record, `IncludedAtendimentosTable` over the hash). Keep that split — it makes the previous revision's three-way `downloadUrl` merge **unnecessary**: downloads stay in section 1, and section 2 is a pure id record sourced from the two hashes only. *(This supersedes the earlier "merge with `zipFilesHistory` for `downloadUrl`" adjustment — cleaner, and drops a join.)*

**Section 1 — "Últimos Arquivos ZIP":** unchanged except it now lists the **2** rotated files (Part D). No component change.

**Section 2 — per-file collapsible blocks.** Add the `atendimentosNaoIncluidos` fetch/state to `useDownloadZip`, then render one block per filename — union of the two hash keys, newest-first by the timestamp embedded in the filename. Block data is just `{ filename, incluidos: string[], naoAdicionados: string[] }`; no history join. Each ZIP now carries **~2–3k ids**, so a block must not dump them inline:

- **Collapsed by default:** header = `filename` + `incluídos: N` + (only when M>0) `não adicionados: M`. That is all most users need.
- **Expand** (native `<details>`/`<summary>` or a `useState` toggle) reveals each id list in a **fixed-height scroll box** (`max-h-48 overflow-y-auto`), **small monospace** (`text-xs font-mono`), ids joined by `", "` so they wrap instead of one-per-line. `ids.join(", ")` is a single text node — cheap even at 3k, so no virtualization.
- **"Não adicionados"** rendered only when non-empty, styled muted/amber as secondary. Optional per-list "copiar" button.

```
┌─ relatorios_atendimentos_2026-07-05_143012.zip ─────────────┐
│  incluídos: 2 950   ·   não adicionados: 47          [ ▸ ]  │  ← collapsed: counts only
└─────────────────────────────────────────────────────────────┘
   ▾ expanded:
   Incluídos (2950)      ┌──────────────────────────────────┐
                         │ 2289131, 2289140, 2289155, …     │  ← scroll box, text-xs mono
                         └──────────────────────────────────┘
   Não adicionados (47)  ┌──────────────────────────────────┐
                         │ 2288004, 2288010, …              │
                         └──────────────────────────────────┘
```

**Keep it simple:** plain blocks + native disclosure + a scroll box. No table library, no virtualization, no sorting UI. The unbounded hash can accumulate many blocks over time — collapsed they're cheap, but optionally cap the rendered count (e.g. newest ~15) with a "ver mais"; the full hash still feeds the Part E helper regardless. Empty state unchanged.

---

## Part D — Limits & rotation (backend)

- **Keep 2 ZIPs on disk, then rotate** (was 5). In `relatorios.export.service.ts`: `cleanupOldZips(this.historyDir, 2)` in `createZipFile` and `.slice(0, 2)` in `getZipHistory`. `cleanupOldZips` already deletes oldest-by-mtime beyond `keep`, so rotation *is* just the number (optionally also drop its `keep = 5` default to 2). The persistent `incluidos`/`naoIncluidos` hashes are untouched — they intentionally outlive disk rotation.
- **Raise the per-ZIP id cap 1,000 → 4,000.** `MAX_ZIP_ATENDIMENTO_IDS` lives in **two** files that must stay in sync: `dto/zip-job.dtos.ts` (backend, drives the controller's over-cap `400`) and `features/download/types/CreateJobParams.ts` (frontend, drives the input's over-limit label). Update both.
- **Load note (not a blocker):** at 4k the Demeter branch does up to 4k single-id resolutions (`getAtendimentoComRelatorioDemeter`, pLimit 5) plus up to 4k PDF assemblies. It is a background BullMQ job (no HTTP timeout) so latency is tolerable, but this is exactly the path the earlier missing-index discussion covers — expect it slow until that index lands. Concurrency stays bounded by the existing `pLimit(3)`/`pLimit(6)`.

---

## Part E — Input UX (frontend)

`AtendimentoIdsInput.tsx` + `DownloadRelatoriosPage.tsx`. Parsing is already robust — the page derives ids via `idsText.match(/\d+/g)` deduped, so any separator (newline/tab/comma/space) already works. These are display/helper concerns, **not** parse fixes.

- **3.1 — Excel-column paste (compact).** Excel copies a column as newline-separated values, so the textarea balloons to ~3k one-per-line rows. Add an `onPaste` handler: `preventDefault`, read `clipboardData.getData("text")`, extract `\d+`, and insert them **comma-separated** at the caret (splice into the current value). It then wraps compactly instead of thousands of lines; the derived count is unchanged. Keep the field `font-mono`, resizable, fixed `rows` with scroll.
- **4 — Real-time "already exported" helper (non-blocking).** Memoize a `Set` of every id in the `atendimentosIncluidos` union (already fetched by the hook). On input change (debounce ~150ms), intersect the current parsed ids with the set and show an **advisory** line under the input, e.g. *"12 de 300 ids já foram incluídos em ZIPs anteriores: 2289131, 2289140, … — isso não impede o envio."*
  - **Never blocks:** no disabling, no auto-dedupe against history — the user MAY re-add an id (e.g. a relatório re-approved after a failed export). Purely informational, soft-warning styling.
  - Checked against **incluídos only** (actually exported), not `naoIncluidos` (those were filtered/errored and are legitimately re-addable).
  - Reuses the existing fetch — **no new endpoint** in v1. That means the client downloads the full incluídos history; fine at current volume but unbounded — see the scaling-risk note for the accepted trade-off and the upgrade path.

---

## Tests

Add to `relatorios.export.service.spec.ts` (drive `resolveZipItems`/`createZipFile` with mocked `atendimentoService`/`relatorioService`/`ZipCreator`):

- **`ativo === false` → excluded** and lands in "não adicionados".
- **`data_see == null` → excluded** and lands in "não adicionados".
- **No atendimento row** for a requested id (missing from `atendimentoMap`) → excluded (unresolved), lands in "não adicionados".
- **Eligible id passes** through to the correct branch (PNAE vs Demeter) and into `includedAtendimentoIds`.
- **Partial PDF failure**: a mix where one region/item errors → the errored id is in "não adicionados", the successful ones in "incluídos"; a ZIP is still produced.
- **`naoAdicionados === requested − included`** for a mixed batch (ineligible + errored + unresolved together).
- **Excluded ids are never stamped**: `setAtendimentosExportDate` is called with the included ids only — assert no ineligible/errored/unresolved id is passed.

## Implementation order

The scope spans several independent concerns; ship and verify them as separate slices, not one drop:

1. **Part D** (4k cap + 2-file rotation) — trivial config, standalone; can land first.
2. **Parts A + B + Tests** (eligibility gate, `naoAdicionados` diff/hash, sibling endpoint) — the core; verifiable via a job run (inspect the two hashes) before any UI exists.
3. **Part C** (history display) — depends on B's endpoint.
4. **Part E** (paste normalizer + duplicate helper) — paste is standalone; the helper only needs the existing incluidos fetch.

Each is its own PR/verify step, so the bundled scope doesn't become one hard-to-review, hard-to-revert change.

## Files touched

- Backend: `relatorios.export.service.ts` (gate in `resolveZipItems`; diff + `hset` in `persistZipSideEffects`; `getAtendimentosNaoIncluidos`; `cleanupOldZips(…, 2)` + `.slice(0, 2)`), `dto/zip-job.dtos.ts` (new key constant + `MAX_ZIP_ATENDIMENTO_IDS = 4000`), `relatorios.controller.ts` (sibling GET route). Update the export-service spec.
- Frontend: `IncludedAtendimentosTable.tsx` (per-file collapsible blocks + scroll box for big id lists + "não adicionados" row), `useDownloadZip.ts` (new `atendimentosNaoIncluidos` fetch/state), `ZipFileMetadata.ts` (new `naoIncluidos` map type), `AtendimentoIdsInput.tsx` (`onPaste` normalizer + advisory helper slot), `DownloadRelatoriosPage.tsx` (wire `naoIncluidos` + duplicate-helper Set), `features/download/types/CreateJobParams.ts` (`MAX_ZIP_ATENDIMENTO_IDS = 4000`).
- Docs: backend AGENTS.md — note the new `GET /relatorios/zip/atendimentos-nao-incluidos`, the eligibility gate, the 4,000 cap, and the 2-file rotation on the ZIP job.

## Out of scope / notes

- No cache changes.
- Mobile is not a consumer of any of these routes — no compatibility concern.
- Per-reason breakdown (why an id was not added: ineligible vs. error vs. unresolved) is intentionally **not** stored in v1 — one flat "não adicionados" list. Add later if the UI needs it.
- **Scaling risk — the unbounded `incluidos`/`naoIncluidos` hashes (accepted for v1).** No TTL/eviction (by design, so old exports stay visible), and the download page `hgetall`s each whole. At ~4k ids/zip it's small now but grows with ZIP history on two axes: **client payload** (both the Part C table *and* the Part E helper Set are built from the full-history fetch, shipped every page load) and **Redis memory**. v1 keeps the client-flatten — zero new infra, reusing the already-fetched hash. **Upgrade path when it gets heavy** (trigger: incluidos payload ≳ 1–2 MB, or the page feels slow): (a) maintain a deduped Redis SET of exported ids (`SADD` in `persistZipSideEffects`, negligible) and back the helper with a lightweight membership endpoint (`POST` pasted ids → already-exported subset), bounding the helper by **input size, not history**; and (b) bound the table's incluidos fetch to recent ZIPs. Not built now.
- Confirm the strict rule intent: include ⇔ `ativo && data_see` (exclude if **either** fails). Flagged because the original phrasing read as an AND of the two negatives.

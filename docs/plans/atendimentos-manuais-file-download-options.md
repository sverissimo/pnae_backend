# Atendimentos Manuais File Download Options

This is a follow-up decision note for the already-implemented manual-relatorio list flow. It focuses
only on the Demeter `arquivo` download problem behind `GET /atendimento/getArquivos` and the
browser action that opens/downloads the legacy relatório.

No implementation code was inspected for this note. Existing `getArquivos` mapping details referenced
below come from `AGENTS.md`, not direct code inspection. It assumes these plans are implemented:

- `emater_graphql_server/docs/plans/atendimento-list-read-endpoint-plan.md`
- `backend/docs/plans/atendimentos-manuais-list.md`
- `web_interface/docs/plans/atendimentos-manuais-frontend-plan.md`

## Context

Legacy relatórios live in Demeter, not PNAE Postgres:

- Each Demeter file row (`arquivo`) is linked to an atendimento by `id_at_atendimento`.
- PNAE `relatorio.atendimento_id` also points to that Demeter atendimento, but that relationship is
  not part of this task. This feature is about legacy manual relatórios sourced directly from
  Demeter files.
- The list screen shows atendimentos that have a legacy/manual relatório. The actual relatório is the
  uploaded file attached to the atendimento.
- Each legacy relatório should normally be treated as a two-file set:
  - the relatório artifact itself;
  - the proof-of-visit photo.
- For PNAE-relevant files, the relatório artifact is always a PDF.
- The proof-of-visit file is always an image.
- Demeter stores the file MIME in `at_arquivo.tipo_arquivo`. A DB check scoped to PNAE-relevant files
  found the supported set is:
  - `application/pdf`
  - `image/gif`
  - `image/jpeg`
  - `image/png`
- The same check found these negative cases:
  - no `application/vnd.openxmlformats-officedocument.wordprocessingml.document`;
  - no `image/tiff`;
  - only 3 rows with `application/msword` across ~160k file rows, treated as bad user input rather
    than a supported format.
- If a PNAE manual-relatório flow hits `application/msword`, never try to assemble or convert it.
  Do not add a special frontend download action for those rows; the assembled-PDF endpoint should
  return a clear unsupported-file error.

The full relevant MIME decision table is:

```txt
Supported:
  application/pdf
  image/gif
  image/jpeg
  image/png

Invalid/bad input:
  application/msword

Not present for PNAE:
  application/vnd.openxmlformats-officedocument.wordprocessingml.document
  image/tiff
```

The original implemented plan aimed for a generated PDF: perfil cover plus embedded manual-relatório
images. With the updated DB facts, the real remaining problem is smaller: copy the relatório PDF
pages, append proof-of-visit images, and reject the rare `application/msword` rows as bad stored data.

## List Metadata Change

Do not sniff bytes to decide what the UI should render. The upstream list can fetch file metadata from
`at_arquivo` by atendimento id, grouped per atendimento, and expose each file with its raw
`tipo_arquivo`.

Suggested backend presentation DTO shape:

```ts
type ArquivoRelatorioManualResumo = {
  idArquivo: number;
  tipoArquivo: string;
  nomeArquivo: string;
};

type AtendimentoComRelatorioManualDTO = {
  // existing fields...
  arquivos: ArquivoRelatorioManualResumo[];
};
```

This shape intentionally mixes raw Demeter metadata (`idArquivo`, `tipoArquivo`) with app-generated
presentation data (`nomeArquivo`). Keep `nomeArquivo` because the backend mapper should generate a
stable app-owned filename for UI labels/downloads. It must not copy Demeter `nome_arquivo`.

The exact upstream SQL should avoid changing the pagination driver. Keep the current keyset query over
`at_atendimento`; after the page IDs are known, load `at_arquivo` rows for those IDs in a batched child
query. That keeps the existing list performance model intact while giving the frontend enough
information to choose icons/actions before the user clicks.

Upstream files read for this decision:

- `/home/apps/emater_graphql_server/src/modules/atendimento/repository/AtendimentoRepository.ts`
  already uses a two-step list flow: raw keyset ids, then Prisma hydration by `pageIds`.
- `/home/apps/emater_graphql_server/src/modules/atendimento/types/atendimentoList.types.ts`,
  `atendimentoListMapper.ts`, and `atendimento.graphql` currently expose atendimento metadata but no
  `arquivos` field.
- `/home/apps/emater_graphql_server/src/generated/prisma/models/at_arquivo.ts` confirms the useful
  columns are `id_at_arquivo`, `arquivo`, `id_at_atendimento`, `ativo`, `tipo_arquivo`, and
  update/sync metadata.

Frontend rendering can then be deterministic:

- `application/pdf` relatório: show **Ver relatório** as the primary action.
- `application/msword`: do not render a special download action; if the user reaches the assembled-PDF
  endpoint, return a clear unsupported-file error.
- Image MIME (`image/gif`, `image/jpeg`, `image/png`): treat as the proof-of-visit photo.
- Generate user-facing filenames in the backend presentation mapper from MIME plus atendimento id, not
  from Demeter `nome_arquivo`. For example: `relatorio_<atendimentoId>` for PDFs and
  `foto_<atendimentoId>` for images. This keeps the messy Demeter filename out of the presentation DTO
  while still giving the frontend a stable display/download name.

## Chosen Packages

Registry metadata was checked on July 1, 2026. Document-conversion packages/tools were intentionally
removed from this plan after the DB check showed PNAE-relevant files are PDF/images, with only 3 bad
`application/msword` rows out of ~160k file rows.

- `@cantoo/pdf-lib` for PDF assembly. It is the maintained fork of `pdf-lib`; prefer it over the
  older unmaintained package for new work.
- `sharp` for image normalization before embedding proof photos into the PDF.

## Phases

### Phase 1: Raw Semantic-File Endpoint

Keep one endpoint that downloads one Demeter file by semantic file type:

- `fileType=relatorio` downloads the original relatório artifact as stored by Demeter.
- `fileType=foto` downloads the proof-of-visit image as stored by Demeter.
- If more than one supported file matches the requested semantic type, return the lowest `idArquivo`
  so the endpoint stays deterministic.

Implementation shape:

- Keep `GET /atendimento/getArquivos?atendimentoId=&fileType=relatorio|foto` as the individual raw
  download endpoint. If a clearer web-only alias is preferred, add only one replacement endpoint, not
  several per file kind.
- Trim the existing semantic MIME mapping to the PNAE-supported set:
  - `fileType=relatorio`: `application/pdf`;
  - `fileType=foto`: `image/jpeg`, `image/png`, `image/gif`.
- Remove dead mapping branches for
  `application/vnd.openxmlformats-officedocument.wordprocessingml.document`, `image/tiff`, and
  `application/msword`.
- Use `at_arquivo.tipo_arquivo` from Demeter to set `Content-Type` and filename extension.
- Use `Content-Disposition: attachment` for formats browsers might try to render inconsistently.
- Use this endpoint for Postman testing and raw downloads of supported PNAE files.

### Phase 2: Combined PDF For PDF Relatório + Proof Image

Make "Ver relatório" try to produce a combined PDF when the relatório artifact is embeddable:

- Always include the perfil cover when available.
- Copy all supported relatório PDF files into the generated PDF, ordered by `idArquivo`.
- Embed all supported proof-of-visit images as image pages, ordered by `idArquivo`.
- If an atendimento unexpectedly has multiple PDFs or multiple images, include all of them in that
  order rather than choosing one silently.
- If the relatório artifact is `application/msword`, return a clear unsupported-file error. Do not try
  to assemble, convert, or expose a special raw-download path for it.

Implementation shape:

- Use the list-provided `tipo_arquivo` metadata to choose actions before fetching.
- Use existing pdf-gen/perfil logic to produce the cover.
- Use `@cantoo/pdf-lib` to assemble:
  - perfil PDF pages;
  - copied pages from relatório PDF;
  - image pages for proof photos.
- Use `sharp` to normalize GIF image encoding to JPEG/PNG before `@cantoo/pdf-lib` embedding if needed.
- If any PDF parsing/embed step fails, return a normal backend error with enough context to diagnose
  the bad file.
- Smoke-test the assembly path with one real PDF relatório plus JPEG/PNG/GIF proof photos. Confirm the
  response opens as a valid PDF, contains the copied relatório pages, and appends proof photos.

## Recommendation

Build Phase 1 first, then Phase 2.

The practical product behavior should be:

- Primary action: **Ver relatório**
  - Opens one generated combined PDF.
  - Includes perfil cover when available.
  - Copies all relatório PDF pages in `idArquivo` order.
  - Includes all proof-of-visit photos in `idArquivo` order when available.
- Error behavior:
  - If `application/msword` appears, return a clear unsupported-file error from the assembled-PDF
    endpoint.
  - If PDF composition fails for a valid PDF/image, return a normal backend error rather than adding
    a parallel raw-file UX.

This gives users a polished single-document experience for the actual PNAE file set and avoids adding
a document-conversion or special-download branch for three bad rows.

## Endpoint Direction

Avoid overloading the existing `getArquivos` route with combined-PDF behavior. Keep it as an individual
file fetch. The intended route shape is:

```txt
GET /relatorios/manual?id=<base64urlToken>
  opens the combined PDF: perfil + relatório PDF pages + proof-of-visit image pages

GET /atendimento/getArquivos?atendimentoId=&fileType=relatorio|foto
  downloads one supported original Demeter file; kept for Postman testing and Phase 1 validation
```

Security/exposure assumption: `GET /relatorios/manual` is already a public/no-auth web route whose
`id` token is only obfuscation, not authorization. Phase 2 deliberately serves the full legacy
relatório PDF content through that same exposure model. The access gate remains list-level user
filtering before the frontend receives the token; this plan does not add route-level auth.

If the raw endpoint needs a clearer name, add only one web-only replacement endpoint and leave
`GET /atendimento/getArquivos` untouched for the existing behavior. Add any new HTTP endpoints to
AGENTS.md under "Endpoints not used by mobile".

## Rollout Plan

1. Add `tipo_arquivo` metadata to the upstream/backend list DTO so the frontend knows which actions
   to render before opening a file.
2. Phase 1: keep/use the raw semantic-file endpoint to validate Demeter file lookup, binary decoding,
   response headers, and real download performance. In this same pass, trim the semantic MIME mapping
   to `application/pdf`, `image/jpeg`, `image/png`, and `image/gif`.
3. Phase 2: add combined PDF support for relatório PDFs + proof-of-visit images.
4. Smoke-test Phase 2 with real Demeter files covering PDF relatório plus JPEG/PNG/GIF proof photos.
5. For `application/msword`, do not add special UI. Let the assembled-PDF endpoint return a clear
   unsupported-file error.

## Resolved Questions

- The relatório artifact is always `application/pdf` for valid PNAE rows.
- The proof-of-visit file is always an image (`image/gif`, `image/jpeg`, or `image/png`).
- The existing `getArquivos` semantic MIME mapping should be narrowed to the supported PNAE set:
  `application/pdf`, `image/gif`, `image/jpeg`, and `image/png`. Do not keep defensive branches for
  DOCX or TIFF, and do not treat `application/msword` as supported.
- The upstream GraphQL list currently hydrates page IDs in
  `AtendimentoRepository.getAtendimentosComRelatorioManual`, then maps through
  `toAtendimentoListItem`. Add the `at_arquivo` metadata after the page IDs are known so pagination
  remains unchanged.
- The generated Prisma model exposes `at_arquivo.id_at_atendimento` and `at_arquivo.tipo_arquivo`, so
  no byte sniffing is needed.
- For `application/msword`, the settled behavior is a clear unsupported-file error from the
  assembled-PDF endpoint, with no special frontend download action.

# Demeter Hydration Cache Plan

## Goal

Speed up the Demeter/manual relatório list, single atendimento lookup, and ZIP preparation paths by
caching the stable hydration data that is expensive to fetch from Demeter.

The expensive pieces are the child/metadata tables joined after the fast atendimento-id selection:

- `at_cli_atend_prop`
- `at_atendimento_usuario`
- `at_arquivo` metadata

These tables are effectively stable for this flow. Demeter usually creates a new atendimento and
marks the previous one inactive instead of updating these child rows in place.

## Current Shape

The list query already has a useful split:

1. Fetch the current page of atendimento ids with the Demeter/manual filter
   (`at_atendimento_indicador.id_at_indicador = 4550`), ordered by atendimento id descending.
2. Hydrate those ids with producer/property/user/file metadata.

The existing backend page cache can stay short-lived. It protects the full page response for about
90 seconds, while the new cache should protect the slower hydration layer for much longer.

## Cache Model

Cache hydration per atendimento id, not as one large page blob.

Conceptual key:

```txt
demeter:atendimento-hydration:v1:<id_at_atendimento>
```

Conceptual value:

```txt
clientes/propriedade/produtor summary
usuarios summary
arquivo metadata
```

Do not cache volatile `at_atendimento` status fields in the long-lived hydration cache. Fields such
as `ativo`, approvals, pendência, export status, and dates should continue to come from the fresh or
short-lived atendimento query.

## Request-Time Behavior

For the existing paginated list:

1. Fetch the current 200 atendimento ids from Demeter using the existing fast id query.
2. Check Redis for hydration entries for those ids.
3. If every id is cached, merge fresh atendimento row data with cached hydration and return.
4. If some ids are missing, hydrate only the missing ids from Demeter.
5. Store those misses in Redis and merge them with the cached entries.

This means the normal 90-second page cache can expire without forcing all 200 rows through the
expensive joins again. Newly created atendimentos only cost hydration for the new ids.

The same hydration cache should also be reused by the single atendimento lookup and ZIP preparation
paths, so older relatórios selected for ZIP generation can benefit even when they are not on the
current first page.

## Scheduled Warmup

Add a gateway-owned warmup job that refreshes all relevant Demeter/manual hydration records.

Relevant records are the atendimentos matching the manual relatório indicator:

```txt
at_atendimento_indicador.id_at_indicador = 4550
```

Current observed size is about 89k atendimentos. A full DB fetch with the needed joins currently
takes only a few minutes, so full relevant-set warmup is practical.

Recommended schedule:

- 06:00: warm cache before the workday.
- 12:15: refresh after the morning window and before afternoon use.

The warmup should be best-effort. If it fails, request-time cache misses still populate Redis.

## Operational Rules

- Use versioned keys so cache shape changes can be rolled out by bumping the version.
- Use a TTL longer than the refresh interval, such as 24 hours, so one missed warmup does not empty
  the cache immediately.
- Use a lock so multiple gateway instances do not run the same warmup at the same time.
- Keep the current short-lived page cache for complete responses.
- Keep request-time hydration fallback; scheduled warmup should improve performance, not become a
  hard dependency.

## Non-Goals

- Do not build a generic cross-app produtor/propriedade/usuario cache in the first pass.
- Do not cache large file binaries in Redis for this flow; cache metadata only.
- Do not replace the DBA index request. Proper indexes on the Demeter FK columns remain the real
  long-term fix.

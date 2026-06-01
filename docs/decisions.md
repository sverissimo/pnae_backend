# Decisions / Rationale — PNAE Backend

Cross-cutting rationale moved out of the root [AGENTS.md](../AGENTS.md) to keep
the always-on rules lean. The root file states the *rule* in one line; this file
holds the *why* and the longer reasoning. Read this before changing one of these
principles; trust current code and config when they conflict.

## KISS, with a reliability floor

KISS is the default for new code. **Exception:** if a simple approach scores below
7/10 on reliability/safety, go fancier.

- Simple ≥ 8.5/10 reliability → keep simple.
- Simple at 7–8.5/10 reliability and a fancier version gives bigger reliability or quality gain → take the fancier version.
- Significantly more complex code for **small** gains → keep simple.

The sync flow ([@domain/relatorio/relatorio-domain-service.ts](../src/@domain/relatorio/relatorio-domain-service.ts)) is the prototypical case where reliability beats simplicity — see [docs/relatorio-sync-doc.md](relatorio-sync-doc.md).

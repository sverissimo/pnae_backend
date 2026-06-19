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

## Comments

Default to none — clear code and naming should speak for themselves. A comment is
an *exception*, used only when **hidden** logic needs a tip (a constraint,
invariant, or deliberate workaround); never narrate *what* the code does.

When you do comment, **keep it brief — ideally one line**: give the gist in a few
words and, if more explanation exists, reference a doc **by name** (e.g. *see
docs/decisions.md "Comments"*) — **never cite line numbers** (they drift, and we
won't track them). 2–3 lines are acceptable only when clearly worth it (non-obvious
code where one or two extra lines beat a doc round-trip); anything longer belongs in
`docs/` with a link, not a wall of comment. A working file's job is to run the app,
not to document itself — that's what `docs/` is for.

**Oversized legacy comment blocks** (e.g. the older `schema.prisma` / module
headers) aren't a fix-now task — trim them *opportunistically* when you already edit
that file. Existing code gets slight slack here; **new code is held strictly.**

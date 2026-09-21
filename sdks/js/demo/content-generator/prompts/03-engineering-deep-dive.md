# Work type 03 — engineering deep dive

**Category:** `engineering/` · **Frontmatter `category`:** `Engineering`
**Length:** 2,000–3,000 words · **Links:** 12+ (6+ internal)

## Required sections, in order

1. `## The problem in one request` — a single concrete request that goes wrong.
2. `## Why the naive approach breaks` — the version most teams build, and the exact input
   that defeats it.
3. `## The mechanism` — how the capability actually behaves, as a customer-visible
   contract: inputs, outputs, ordering, what is atomic, what is best-effort.
4. `## Worked example` — real numbers, a table or a fenced block, arithmetic shown.
5. `## Edge cases we had to decide` — 3–5, each stated as "when X, we do Y, because Z".
   This is the section that makes the post worth reading and it is the one most often
   skipped.
6. `## What you see from the outside` — headers, ledger rows, dashboard fields, status
   codes. Customer-visible only.
7. `## Limits` — where it does not apply, honestly.
8. `## Try it` → `## See also` → `## Sources`.

## Proof obligation

- **Customer-facing surface only.** Never the routing engine's name, internal ports, the
  master key, our database, our schema, table names, or same-UUID-across-services. If the
  premise is an internal mechanism with no customer-facing feature, the post is not written.
- Response headers are the canonical `x-nr-*` names, and a cost header that can be absent is
  described as absent, never as zero.
- Every claim about behaviour under failure names the failure and the outcome.

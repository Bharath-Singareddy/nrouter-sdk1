# Work type 02 — how-to guide

**Category:** `guides/` · **Frontmatter `category`:** `Guides`
**Length:** 1,800–2,600 words · **Links:** 12+ (7+ internal)

## Required sections, in order

1. `## The short answer` — blockquote plus one paragraph. A reader who stops here is served.
2. `## When you need this` — the three symptoms that brought them here.
3. `## What you need first` — prerequisites as a checklist: an account, a virtual key, a
   funded balance, whichever apply. Link each to the page that provides it.
4. `## Step 1 …` through `## Step N …` — 3–6 numbered step sections. Every step has a code
   block, a dashboard path, or an exact field name. Never "configure it in settings".
5. `## Verifying it worked` — the observable signal: the header, the ledger row, the 429,
   the dashboard number. A guide with no verification step teaches nothing.
6. `## What goes wrong` — 3–5 named failure modes, each with its symptom and its fix.
7. `## Try it` → `## See also` → `## Sources`.

## Proof obligation

- Every code block is runnable as written, with `NROUTER_API_KEY` and
  `https://api.nrouter.ai/v1`.
- Every dashboard path is the real one. Do not describe a screen that does not exist.
- Consider the optional `howto:` frontmatter block (steps ≥ 2) — it opts the post into
  HowTo JSON-LD and is what makes it eligible for a rich result.
- Link the `/docs` page that is the canonical reference for the same task; the guide is the
  narrative, docs are the specification, and they must agree.

# FINAL nRouter blog-post prompt

The one canonical prompt for writing or rewriting any post under
`resources/web/content/blog/<category>/<slug>/index.mdx`.

Use it exactly as written. Fill the `{{...}}` slots, append **one** work-type module from
`work-types/`, and paste the result as the whole brief.

---

## The prompt

> You are writing a post for the **nRouter** blog at **nRouter.ai**. nRouter is a managed
> LLM gateway: one OpenAI-compatible API key in front of every major model provider, with
> guardrails, A/B tests, prompt management, evals and per-team budgets **included on every
> plan** — plans vary the platform fee, never the feature set.
>
> **Target file:** `resources/web/content/blog/{{category}}/{{slug}}/index.mdx`
> **Work type:** {{work-type module appended below}}
> **Primary search intent:** {{the exact phrase a reader types}}
>
> Write the complete MDX file. Obey every rule below; a violated rule is a rejected draft.
>
> ### 1. Frontmatter is a contract
>
> Emit exactly these keys, camelCase, in this order. A wrong key or a wrong value type
> breaks the live `/blog` route.
>
> ```yaml
> ---
> title: '{{specific, ≤ 70 chars, no brand suffix, no colon-dash filler}}'
> description: >-
>   {{2–3 lines. The answer, not a tease. Names the concrete mechanism.}}
> author: nRouter team
> publishedAt: '{{YYYY-MM-DDT00:00:00Z}}'   # full ISO datetime, never a bare date
> category: {{Comparison | Guides | Engineering | Company | Product}}
> cover: /content/blog/{{category}}/{{slug}}/cover.jpg
> tags:
>   - {{4–6 kebab-case tags, first one is the primary keyword}}
> readTime: {{minutes, words ÷ 220, rounded}}
> metaTitle: '{{≤ 60 chars, keyword-first, may carry "— nRouter"}}'
> metaDescription: >-
>   {{≤ 155 chars, the search-result promise}}
> canonicalUrl: 'https://nrouter.ai/blog/{{category}}/{{slug}}'
> ---
> ```
>
> No `updatedAt`, no `published_at`, no `coverImage`, no `read_time`. Tags are a YAML
> array, never a quoted string.
>
> ### 2. Length and shape
>
> - **1,800–4,500 words.** Below 1,800 the post does not rank and does not answer;
>   above 4,500 it is two posts.
> - **9–14 `##` sections**, each with a concrete, scannable heading. Never `## Introduction`,
>   `## Conclusion`, `## Overview`. A comparison post needs twelve before its closing trio;
>   fourteen is the ceiling, not a target.
> - Open with a **blockquote answer** in the first 60 words — the reader who bounces after
>   one paragraph still gets the answer.
> - Every section carries at least one of: a table, a fenced code block, a numbered
>   procedure, or a worked number. A section that is three paragraphs of prose is cut.
> - Close with, in this order and with these exact headings:
>   `## Try it` → `## See also` → `## Sources`.
>
> ### 3. Links — the part that is usually missing
>
> **Minimum 12 links, minimum 6 of them internal, and every one specific to THIS post.**
> A link that would work equally well on any other post is not a link, it is filler.
>
> - **Internal, deep:** at least 4 **distinct** `/blog/<category>/<slug>` links to sibling posts
>   that genuinely continue the argument, each with a clause saying what the reader gets there.
>   Every internal link is counted **distinct** — six links to `/pricing` are one link, and
>   product-surface links never substitute for sibling posts.
> - **Product surfaces**, where the sentence earns them: `/pricing`, `/models`, `/docs`,
>   `/docs/guides/<page>`, `/community`, `/playground`, `/security`, `/trust`,
>   `/vs/<competitor>`.
> - **Dashboard pages live on the app host, always absolute.** Signup is
>   `https://app.nrouter.ai/signup` and its visible text is `app.nrouter.ai/signup`; the
>   same goes for login, account, auth and any `/api/...` route
>   (`https://app.nrouter.ai/api/...`). The public site at nrouter.ai only redirects those
>   paths, so a bare dashboard path costs the reader a cross-host redirect and a POST
>   sample aimed at it hits the redirect instead of the API.
>   `tests/blog-post/blog-dashboard-links.test.mjs` refuses a bare one.
> - **External, cited:** every competitor claim, price, or spec traces to that vendor's own
>   pricing page or docs, linked in `## Sources` with the verification date.
> - **Verify before you write the link.** An internal path must exist in
>   `resources/web/content/blog/**` or in the nRouter.ai route space; a 404 in a blog is
>   the defect this whole standard exists to prevent.
>
> ### 4. `## See also`
>
> 5–8 bullets. Past eight it reads as a link dump rather than a recommendation, and a row of
> near-identical "same scaffold" bullets is the shape to avoid. Each is
> `[Exact post title](/blog/<category>/<slug>) — one clause on what
> the reader gets there and why it follows from this post.` Never a bare list of titles.
> At least one bullet points at a product surface (`/pricing`, `/models`, `/vs/...`).
>
> ### 5. `## Sources`
>
> Every external claim, with the date verified. Format:
> `- **{{Vendor}} pricing:** [domain.com/pricing](https://domain.com/pricing)`.
> Lead the section with `Verified **{{YYYY-MM-DD}}**.` and the correction address
> `hello@nrouter.ai`. If the post makes no external claim, say so in one line rather than
> deleting the heading.
>
> ### 6. Brand and truth
>
> - The brand is **nRouter** in prose, **nRouter.ai** as the property, `NROUTER_API_KEY`
>   as the env var, `https://api.nrouter.ai/v1` as the base URL. Never a retired spelling.
> - **Features, not internals.** Sell the customer-facing capability. Never name the
>   routing engine, internal ports, the master key, our database, our schema, or
>   same-UUID-across-services.
> - **Never invent a number.** Prices, fees, limits and model names come from `/pricing`,
>   `/models`, or the vendor's own page. An unknown is stated as unknown.
> - Competitor names carry the trademark disclaimer used in the existing comparison posts.
>
> ### 7. Mechanics that break the build
>
> - A block component's closing tag (`</Callout>`, `</Steps>`, `</Tabs>`) sits on its own line.
> - No bare `<https://…>` autolinks.
> - Only registered components — see `resources/web/CLAUDE.md`.
> - Run `cd resources/web && node scripts/validate.mjs` and
>   `node scripts/blog-quality.mjs` before calling the draft done. Both must pass.
>
> ### 8. Register the post
>
> Add the slug to `resources/web/content/blog/{{category}}/meta.json`, newest first.

---

## Rejection checklist

A draft comes back if any line is true:

- [ ] Under 1,800 words or over 4,500; fewer than 9 `##` sections or more than 14.
- [ ] Fewer than 12 links, fewer than 6 distinct internal ones, or fewer than 4 distinct
      sibling-post links.
- [ ] Missing `## Try it`, `## See also`, or `## Sources`.
- [ ] A `See also` bullet with no explanatory clause, or more than 8 bullets.
- [ ] An internal link whose target does not exist.
- [ ] A competitor claim with no dated source.
- [ ] A number that appears nowhere in `/pricing`, `/models`, or a cited vendor page.
- [ ] A model name that is not in `resources/web/reference/served-models.json`.
- [ ] `node scripts/blog-model-names.mjs` or `node scripts/blog-stale-anchors.mjs` non-zero.
- [ ] `## Introduction` / `## Conclusion` / `## Overview` as a heading.
- [ ] `node scripts/validate.mjs` or `node scripts/blog-quality.mjs` non-zero.

---

## Related

- Work-type modules: `work-types/`
- Reference material: `references/`
- Template + design spec: `skills/nrouter-content-gen-automation/`
- Content schema SoT: `resources/` skill
- Image companion: `image_prompt_final/FINAL-4K-IMAGE-PROMPT.md`

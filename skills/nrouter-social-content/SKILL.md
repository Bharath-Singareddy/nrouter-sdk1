---
name: nrouter-social-content
description: Create complete nRouter campaign content from an idea or campaign catalogue entry, including the campaign angle, headline and hooks, LinkedIn, Instagram, X, YouTube or other platform copy, and an optional complete blog article. Use for generation, human review, and scheduling approved written content; exclude image and video generation.
---

# nRouter social content

Turn one campaign idea into an accurate, reviewable content package. This skill produces and schedules approved written content only. It does not create images or videos, and scheduling does not imply that an external platform published the post.

## Choose the source

- **Campaign catalogue:** Read [references/campaign-ideas.csv](references/campaign-ideas.csv) and use the selected row's `user_prompt` as the source.
- **Custom idea:** Start from a supplied idea, product update, or approved facts.
- **Repurpose:** Convert a finished article or release note into a campaign without changing its claims.
- **Review:** Improve a supplied package and check platform fit, links, facts, privacy, and calls to action.

Read [references/platforms.md](references/platforms.md) when adapting copy to a named platform.

## Build the campaign brief

Use information already supplied before asking questions. Resolve ordinary choices with these defaults:

- Audience: AI developers and engineering teams.
- Goal: awareness and useful engagement.
- Voice: pragmatic, sharp, authoritative, engineer-to-engineer.
- Variations: three per selected platform.
- Delivery: manual export or local scheduling after human review.

The brief needs a source idea or text and at least one target platform. Preserve an exact article URL, call to action, required facts, forbidden claims, and requested article length when provided. The marketing user should not need to choose a model or understand prompt architecture.

For nRouter, use the brand spellings `nRouter`, `nRouter.ai`, `NROUTER_API_KEY`, and `https://api.nrouter.ai/v1`. Describe customer-visible capabilities. Do not expose internal service names, ports, master credentials, database details, or unpublished roadmap items.

## Generate the complete content package

Produce these sections in order:

1. **Campaign angle** — the audience problem, nRouter message, desired reader action, and one-sentence positioning.
2. **Headline and hooks** — one primary headline plus three distinct hooks.
3. **Social post copy** — clearly separated, ready-to-edit variations for every selected platform.
4. **Blog/article** — only when requested: title, opening hook, article structure, complete final article, and CTA.
5. **Review checklist** — factual claims, links, platform fit, brand terms, unsupported statements, and items requiring human confirmation.

- Open with a concrete hook that earns attention without clickbait.
- Prefer a problem, customer-visible mechanism, proof, and useful takeaway.
- Use only facts from the source or verified public nRouter material. Never invent metrics, prices, customers, benchmarks, model availability, or feature status.
- Preserve important qualifications from the source.
- Keep calls to action specific and use the supplied URL when one exists.
- Do not put secrets, personal data, API keys, or platform tokens into generated copy.
- Do not generate image concepts, image text, video concepts, scenes, or scripts in this skill.

When a factual claim may have changed, verify it against an authoritative current source before using it. If verification is unavailable, omit the claim or label it for review.

## Human review gate

Before presenting a draft as ready:

1. Check each draft against the selected platform's current format and publishing constraints.
2. Confirm links, product names, claims, and calls to action.
3. Remove unsupported superlatives, repeated angles, private information, and secrets.
4. Confirm the campaign angle, headline, social copy, and optional article carry the same message.
5. Present the package in an editable form and label it `draft` until a person approves it.

Generation never implies approval. Review the messaging once before download or scheduling.

## Approved scheduling

After the exact final copy is approved, it may be added to a local schedule queue.

- Preserve the approved copy exactly; do not regenerate it at execution time.
- Record the selected destinations, absolute date/time, time zone, approval state, and queue status.
- Never store the nRouter API key or a platform credential with the scheduled content.
- If a destination has no authorized connector when the job becomes due, mark it `awaiting_connector`; do not claim it was published.
- Check existing delivery state before any future retry so the same content is not posted twice.
- Allow a queued or connector-blocked item to be cancelled.

Provide copy and download as a manual fallback.

## Output

Return the campaign angle, headline/hooks, platform drafts, optional complete article, review findings, and scheduling readiness. Include a queue record only after approval. Keep credentials and internal request details out of the content artifact.

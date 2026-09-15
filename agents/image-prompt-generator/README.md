# nRouter Image Prompt Generator SDK

This package exposes `generateImagePrompt(options)`, an SDK utility that generates highly optimized prompts for image models.

## Brand & Skill Integration

**How Brand Assets and Guidelines are Incorporated:**
We actively parsed the nRouter branding guidelines (via the `image` skill) which explicitly state that nRouter imagery must:
1. **Never use stock photos or photorealism.**
2. **Utilize vector-style, abstract tech visualizations.**
3. **Strictly adhere to the nRouter palette:** deep navy primary (`#0F172A`) with vibrant blue and purple accents.

These constraints are injected as absolute directives into the System Prompt of the underlying Agent model payload. This guarantees that regardless of the user's input, the resulting generated image prompt will forcefully request an image aligned with the nRouter aesthetic.

## Local Playwright Testing

To run the Playwright end-to-end test suite:
```bash
NROUTER_API_KEY="sk-nrouter-..." npm run test:e2e
```

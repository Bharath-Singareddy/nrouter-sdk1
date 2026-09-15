# nRouter Video Prompt Generator SDK

This package exposes `generateVideoPrompt(options)`, an SDK utility that generates highly optimized prompts for video generation models.

## Brand & Skill Integration

**How Video Skills are Incorporated:**
Video generation models (like Google Veo, Luma Dream Machine, Sora) require explicit camera linguistics and lighting physics to produce coherent generations. The agent is explicitly instructed to adapt the prompt to the selected `videoModel`'s strengths, automatically appending specific cinematic terms (e.g., "dolly-in", "volumetric light") to ensure the generated video aligns with high-end tech commercial standards.

## Local Playwright Testing

To run the Playwright end-to-end test suite:
```bash
NROUTER_API_KEY="sk-nrouter-..." npm run test:e2e
```

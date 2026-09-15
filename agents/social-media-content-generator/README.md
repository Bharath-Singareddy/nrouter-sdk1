# nRouter Social Media Content Generator SDK

This package exposes `generateSocialMediaContent(options)`, an SDK utility that drafts viral social media posts for nRouter.

## Brand & Skill Integration

**How Brand Tone is Incorporated:**
The nRouter social presence requires a specific tone: punchy, technical, yet accessible. The agent's system prompt ensures that the generated content avoids overly dense corporate jargon in favor of a "developer-friendly" voice. It dynamically adapts to previously discussed history so that angles aren't repeated.

## Local Playwright Testing

To run the Playwright end-to-end test suite:
```bash
NROUTER_API_KEY="sk-nrouter-..." npm run test:e2e
```

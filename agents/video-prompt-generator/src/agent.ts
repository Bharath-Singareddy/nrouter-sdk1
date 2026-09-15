import { nRouter } from '@nrouter_ai/sdk';
import fs from 'node:fs';

export interface VideoPromptOptions {
  apiKey?: string;
  query: string;
  videoModel: string;
}

export async function generateVideoPrompt(options: VideoPromptOptions): Promise<string> {
  const client = new nRouter({
    apiKey: options.apiKey || process.env.NROUTER_API_KEY,
  });

  const systemBase = fs.readFileSync(new URL('../skills/instructions.md', import.meta.url), 'utf-8');

  const response = await client.nr.messages({
    model: process.env.NROUTER_MODEL || 'claude-haiku-4-5-20251001',
    system: systemBase + '\n\nTarget Model: ' + options.videoModel,
    messages: [
      {
        role: 'user',
        content: options.query
      }
    ],
    max_tokens: 1024,
  });

  const body = response.body as any;
  const textBlock = body.content?.find((c: any) => c.type === 'text');
  if (textBlock) {
    return textBlock.text;
  }
  return '';
}
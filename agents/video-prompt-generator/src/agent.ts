import { nRouter } from '@nrouter_ai/sdk';

export interface VideoPromptOptions {
  apiKey?: string;
  query: string;
  videoModel: string;
}

export async function generateVideoPrompt(options: VideoPromptOptions): Promise<string> {
  const client = new nRouter({
    apiKey: options.apiKey || process.env.NROUTER_API_KEY,
  });

  const response = await client.nr.messages({
    model: process.env.NROUTER_MODEL || 'claude-haiku-4-5-20251001',
    system: `You are the Video Prompt Generator.
Generate a highly optimized prompt tailored to the specified video model's strengths (${options.videoModel}). 
Include camera motion terms and lighting details suitable for this specific architecture.`,
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

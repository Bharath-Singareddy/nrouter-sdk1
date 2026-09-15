import { nRouter } from '@nrouter_ai/sdk';

export interface SocialMediaOptions {
  apiKey?: string;
  topic: string;
  history?: string[];
}

export async function generateSocialMediaContent(options: SocialMediaOptions): Promise<string> {
  const client = new nRouter({
    apiKey: options.apiKey || process.env.NROUTER_API_KEY,
  });

  const historyContext = options.history && options.history.length > 0 
    ? `\n\nPreviously discussed topics (avoid repeating these exact angles):\n- ${options.history.join('\n- ')}` 
    : '';

  const response = await client.nr.messages({
    model: process.env.NROUTER_MODEL || 'claude-haiku-4-5-20251001',
    system: `You are the nRouter Social Media Content Generator.
Your goal is to draft viral social media posts (for X/Twitter, LinkedIn, etc.) about nRouter.
Keep the tone engaging, technical yet accessible. Use relevant hashtags like #AI #DevTools #nRouter.${historyContext}`,
    messages: [
      {
        role: 'user',
        content: options.topic
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

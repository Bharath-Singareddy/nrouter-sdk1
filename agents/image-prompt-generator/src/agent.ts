import { nRouter } from '@nrouter_ai/sdk';

export interface ImagePromptOptions {
  apiKey?: string;
  query: string;
}

export async function generateImagePrompt(options: ImagePromptOptions): Promise<string> {
  const client = new nRouter({
    apiKey: options.apiKey || process.env.NROUTER_API_KEY,
  });

  const response = await client.nr.messages({
    model: process.env.NROUTER_MODEL || 'claude-haiku-4-5-20251001',
    system: `You are the nRouter Image Prompt Generator.
Your goal is to generate highly optimized prompts for image models based on user requests.
You MUST adhere to the nRouter image branding standard:
1. All images must align with the nRouter brand (clean, modern, technical).
2. Avoid generic corporate stock photos; prefer vector-style or abstract tech visualizations.
3. Use the nRouter color palette: primary #0F172A (navy), accents in vibrant blue and purple.
Output only the final prompt.`,
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

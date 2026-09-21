#!/usr/bin/env node

import assert from 'node:assert/strict';
import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB_DIR = path.join(HERE, 'web');
const PORT = Number.parseInt(process.env.PORT || '4318', 10);
const DEFAULT_MODEL = process.env.NROUTER_CONTENT_MODEL || 'gpt-4.1-mini';
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;

const BLOG_TYPES = {
  '01-comparison-alternative': { category: 'product', frontmatterCategory: 'Comparison', label: '01 — comparison / alternative' },
  '02-how-to-guide': { category: 'guides', frontmatterCategory: 'Guides', label: '02 — how-to guide' },
  '03-engineering-deep-dive': { category: 'engineering', frontmatterCategory: 'Engineering', label: '03 — engineering deep dive' },
  '04-company-position': { category: 'company', frontmatterCategory: 'Company', label: '04 — company position' },
  '05-product-capability': { category: 'product', frontmatterCategory: 'Product', label: '05 — product capability' },
};

const BLOG_PROMPT = await readFile(path.join(HERE, 'prompts', 'final-blog-post.md'), 'utf8');
const BLOG_MODULES = Object.fromEntries(await Promise.all(Object.keys(BLOG_TYPES).map(async (type) => [
  type,
  await readFile(path.join(HERE, 'prompts', `${type}.md`), 'utf8'),
])));

const TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
};

function sendJson(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 64_000) reject(new Error('Request body is too large.'));
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error('Request body must be valid JSON.'));
      }
    });
    req.on('error', reject);
  });
}

function value(input) {
  return String(input || '').trim();
}

function buildContentPrompt(input) {
  const topic = value(input.topic);
  if (!topic) throw new Error('Enter a topic or idea first.');

  const type = value(input.type) || 'article';
  const lines = [
    `Create a polished ${type} about: ${topic}`,
    input.audience && `Audience: ${value(input.audience)}`,
    input.goal && `Goal: ${value(input.goal)}`,
    input.tone && `Tone: ${value(input.tone)}`,
    input.length && `Length: ${value(input.length)}`,
    input.keyPoints && `Key points to cover:\n${value(input.keyPoints)}`,
    input.callToAction && `Call to action: ${value(input.callToAction)}`,
    'Use clear, specific language. Keep facts accurate. Return only the finished content, ready to publish.',
  ];
  return lines.filter(Boolean).join('\n\n');
}

function buildBlogPrompt(input) {
  const workType = value(input.workType);
  const config = BLOG_TYPES[workType];
  if (!config) throw new Error('Choose a valid blog work type.');

  const slug = value(input.slug).toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new Error('Use a lowercase, hyphen-separated slug, such as smart-model-routing.');
  }

  const searchIntent = value(input.searchIntent);
  if (!searchIntent) throw new Error('Enter the exact phrase a reader would search for.');

  const publishedAt = value(input.publishedAt) || new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(publishedAt)) throw new Error('Choose a valid publication date.');

  const competitor = value(input.competitor);
  if (workType === '01-comparison-alternative' && !competitor) {
    throw new Error('Enter the competitor name for a comparison post.');
  }

  const replacements = new Map([
    ['{{category}}', config.category],
    ['{{slug}}', slug],
    ['{{work-type module appended below}}', config.label],
    ['{{the exact phrase a reader types}}', searchIntent],
    ['{{YYYY-MM-DDT00:00:00Z}}', `${publishedAt}T00:00:00Z`],
    ['{{YYYY-MM-DD}}', publishedAt],
    ['{{Comparison | Guides | Engineering | Company | Product}}', config.frontmatterCategory],
  ]);

  let prompt = BLOG_PROMPT;
  for (const [slot, replacement] of replacements) prompt = prompt.replaceAll(slot, replacement);

  let module = BLOG_MODULES[workType];
  if (competitor) {
    module = module
      .replaceAll('{{Competitor}}', competitor)
      .replaceAll('{{competitor}}', competitor.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
  }
  return `${prompt.trim()}\n\n---\n\n${module.trim()}`;
}

function buildPrompt(input) {
  return value(input.mode) === 'blog' ? buildBlogPrompt(input) : buildContentPrompt(input);
}

function protectEmails(text) {
  const originals = [];
  return {
    text: text.replace(EMAIL_PATTERN, (email) => {
      originals.push(email);
      return `[[CONTACT_ADDRESS_${originals.length}]]`;
    }),
    originals,
  };
}

function restoreEmails(text, originals) {
  return originals.reduce(
    (restored, email, index) => restored.replaceAll(`[[CONTACT_ADDRESS_${index + 1}]]`, email),
    text,
  );
}

function costFrom(headers) {
  const raw = headers.get('x-nr-request-cost');
  if (raw === null || !/^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(raw.trim())) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && !(parsed === 0 && /[1-9]/.test(raw)) ? parsed : null;
}

function extractText(payload) {
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content === 'string' && content.trim()) return content.trim();
  if (Array.isArray(content)) {
    const joined = content.map((part) => typeof part === 'string' ? part : part?.text || '').join('').trim();
    if (joined) return joined;
  }
  throw new Error('The model returned no written content.');
}

function gatewayError(payload, status) {
  return payload?.error?.message || payload?.message || `Gateway request failed (${status}).`;
}

async function createContent(body) {
  if (!process.env.NROUTER_API_KEY) {
    const error = new Error('Add NROUTER_API_KEY to content-generator/.env, then restart the server.');
    error.status = 503;
    throw error;
  }

  const prompt = value(body.prompt) || buildPrompt(body);
  const protectedPrompt = protectEmails(prompt);
  const model = value(body.model) || DEFAULT_MODEL;
  const maxTokens = Number(body.maxTokens || 1000);
  if (!model) throw new Error('A text model is required.');
  if (!Number.isInteger(maxTokens) || maxTokens < 100 || maxTokens > 8000) {
    throw new Error('Maximum tokens must be an integer from 100 through 8000.');
  }

  const baseUrl = (process.env.NROUTER_BASE_URL || 'https://api.nrouter.ai/v1').replace(/\/$/, '');
  let response;
  try {
    response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${process.env.NROUTER_API_KEY}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: 'You are an expert content writer. Follow the requested format, audience, tone, and length. Preserve tokens like [[CONTACT_ADDRESS_1]] exactly.' },
          { role: 'user', content: protectedPrompt.text },
        ],
        max_tokens: maxTokens,
        temperature: 0.7,
      }),
    });
  } catch (error) {
    throw new Error(`Unable to reach nRouter (${error.cause?.code || error.message}).`);
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(gatewayError(payload, response.status));
  const generatedContent = extractText(payload);
  return {
    content: restoreEmails(generatedContent, protectedPrompt.originals),
    protectedEmailCount: protectedPrompt.originals.length,
    model: payload.model || model,
    usage: payload.usage || null,
    cost: costFrom(response.headers),
    costStatus: response.headers.get('x-nr-cost-status'),
    requestId: response.headers.get('x-nr-request-id'),
  };
}

async function serveFile(res, file) {
  const info = await stat(file);
  res.writeHead(200, {
    'content-type': TYPES[path.extname(file)] || 'application/octet-stream',
    'content-length': info.size,
    'cache-control': 'no-store',
  });
  createReadStream(file).pipe(res);
}

function selfTest() {
  const prompt = buildContentPrompt({ topic: 'AI routing', type: 'blog post', audience: 'developers' });
  assert.match(prompt, /AI routing/);
  assert.match(prompt, /developers/);
  assert.throws(() => buildContentPrompt({}));
  const blogPrompt = buildBlogPrompt({
    workType: '02-how-to-guide',
    slug: 'smart-model-routing',
    searchIntent: 'how to route llm requests',
    publishedAt: '2026-09-21',
  });
  assert.match(blogPrompt, /resources\/web\/content\/blog\/guides\/smart-model-routing\/index\.mdx/);
  assert.match(blogPrompt, /Primary search intent:\*\* how to route llm requests/);
  assert.match(blogPrompt, /# Work type 02/);
  assert.doesNotMatch(blogPrompt, /\{\{category\}\}|\{\{slug\}\}/);
  assert.throws(() => buildBlogPrompt({ workType: '01-comparison-alternative', slug: 'vendor-alternative', searchIntent: 'vendor alternative' }), /competitor/i);
  assert.equal(extractText({ choices: [{ message: { content: 'Ready' } }] }), 'Ready');
  assert.equal(costFrom(new Headers({ 'x-nr-request-cost': '0.001' })), 0.001);
  assert.equal(costFrom(new Headers()), null);
  const protectedEmails = protectEmails('Contact hello@nrouter.ai or jane@example.com.');
  assert.equal(protectedEmails.text, 'Contact [[CONTACT_ADDRESS_1]] or [[CONTACT_ADDRESS_2]].');
  assert.deepEqual(protectedEmails.originals, ['hello@nrouter.ai', 'jane@example.com']);
  assert.equal(restoreEmails(protectedEmails.text, protectedEmails.originals), 'Contact hello@nrouter.ai or jane@example.com.');
  assert.deepEqual(protectEmails('No contact details here.'), { text: 'No contact details here.', originals: [] });
  console.log('OK: content generator server');
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || '127.0.0.1'}`);
    if (req.method === 'GET' && url.pathname === '/api/health') {
      return sendJson(res, 200, { ok: true, hasKey: Boolean(process.env.NROUTER_API_KEY), model: DEFAULT_MODEL });
    }
    if (req.method === 'POST' && url.pathname === '/api/prompt') {
      return sendJson(res, 200, { prompt: buildPrompt(await readJson(req)) });
    }
    if (req.method === 'POST' && url.pathname === '/api/content') {
      return sendJson(res, 200, await createContent(await readJson(req)));
    }

    const asset = url.pathname === '/' ? 'index.html' : path.basename(url.pathname);
    if (!['index.html', 'app.js', 'styles.css'].includes(asset)) return sendJson(res, 404, { error: 'Not found' });
    await serveFile(res, path.join(WEB_DIR, asset));
  } catch (error) {
    sendJson(res, error.status || 400, { error: error.message || String(error) });
  }
});

if (process.argv.includes('--self-test')) {
  selfTest();
} else {
  server.listen(PORT, '127.0.0.1', () => {
    console.log(`nRouter Content Generator: http://127.0.0.1:${PORT}`);
    console.log(process.env.NROUTER_API_KEY ? 'API key loaded from the server environment.' : 'No API key found; generation is disabled.');
  });
}

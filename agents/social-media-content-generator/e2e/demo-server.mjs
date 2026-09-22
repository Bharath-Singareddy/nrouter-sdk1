import http from 'node:http';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateSocialMediaContent } from '../dist/agent.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const port = Number.parseInt(process.env.PORT || '4174', 10);
const host = process.env.HOST || '127.0.0.1';
const model = process.env.NROUTER_MODEL || 'claude-haiku-4-5-20251001';
const campaignCataloguePath = path.resolve(here, '../../../skills/nrouter-social-content/references/campaign-ideas.csv');
const schedulePath = path.join(here, 'data', 'schedules.json');
const assets = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/app.css', ['app.css', 'text/css; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/assets/nrouter-logo.png', ['assets/nrouter-logo.png', 'image/png']],
]);

function sendJson(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 150_000) reject(new Error('Request is too large.'));
    });
    req.on('end', () => {
      try { resolve(raw ? JSON.parse(raw) : {}); }
      catch { reject(new Error('Request body must be valid JSON.')); }
    });
    req.on('error', reject);
  });
}

function text(value) {
  return String(value || '').trim();
}

function parseCsvLine(line) {
  const fields = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"' && quoted && line[index + 1] === '"') {
      field += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === ',' && !quoted) {
      fields.push(field);
      field = '';
    } else {
      field += character;
    }
  }
  fields.push(field);
  return fields;
}

async function readCampaignCatalogue() {
  const rows = (await fs.readFile(campaignCataloguePath, 'utf8')).trim().split(/\r?\n/).map(parseCsvLine);
  const headers = rows.shift();
  return rows.map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] || ''])));
}

async function readSchedules() {
  try {
    const schedules = JSON.parse(await fs.readFile(schedulePath, 'utf8'));
    return Array.isArray(schedules) ? schedules : [];
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

async function writeSchedules(schedules) {
  await fs.mkdir(path.dirname(schedulePath), { recursive: true });
  const temporaryPath = `${schedulePath}.tmp`;
  await fs.writeFile(temporaryPath, `${JSON.stringify(schedules, null, 2)}\n`, 'utf8');
  await fs.rename(temporaryPath, schedulePath);
}

async function refreshScheduleStatuses() {
  const schedules = await readSchedules();
  const now = Date.now();
  let changed = false;
  for (const schedule of schedules) {
    if (schedule.status === 'scheduled' && Date.parse(schedule.scheduledAt) <= now) {
      schedule.status = 'awaiting_connector';
      schedule.statusMessage = 'Due time reached. Waiting for an authorized platform connector.';
      changed = true;
    }
  }
  if (changed) await writeSchedules(schedules);
  return schedules;
}

function buildPrompt(body) {
  const idea = text(body.idea);
  if (!idea) throw new Error('Enter a content idea first.');

  const allowedPlatforms = new Set(['LinkedIn', 'Instagram', 'X', 'YouTube']);
  const platforms = Array.isArray(body.platforms)
    ? body.platforms.map(text).filter((platform) => allowedPlatforms.has(platform))
    : [];
  if (!platforms.length) throw new Error('Select at least one platform.');

  const variations = Number(body.variations || 3);
  if (!Number.isInteger(variations) || variations < 1 || variations > 5) {
    throw new Error('Variations must be between 1 and 5.');
  }

  return [
    'Create a complete written campaign content package for nRouter.',
    '',
    `Core idea: ${idea}`,
    `Content type: ${text(body.contentType) || 'Technical insight'}`,
    `Goal: ${text(body.goal) || 'Awareness and engagement'}`,
    `Audience: ${text(body.audience) || 'AI developers and technical teams'}`,
    `Tone: ${text(body.tone) || 'Professional and developer-friendly'}`,
    `Destinations: ${platforms.join(', ')}`,
    `Variations per destination: ${variations}`,
    `Include complete blog article: ${body.includeBlog ? 'yes' : 'no'}`,
    body.includeBlog && `Requested article length: ${text(body.articleLength) || 'Standard — about 1,500 words'}`,
    body.sourceUrl && `Source URL: ${text(body.sourceUrl)}`,
    body.callToAction && `Call to action: ${text(body.callToAction)}`,
    body.keyPoints && `Required points:\n${text(body.keyPoints)}`,
    '',
    'Output requirements:',
    '- Start with ## Campaign angle: audience problem, nRouter message, desired action and one-sentence positioning.',
    '- Add ## Headline and hooks: one primary headline and three distinct hooks.',
    '- Add ## Social post copy with a separate heading for every destination and variation.',
    body.includeBlog && '- Add ## Blog article containing a title, opening hook, article structure, complete final article and CTA.',
    '- End with ## Review checklist covering claims, links, brand terms and anything requiring human confirmation.',
    '- Return finished written content that a person can edit, download and publish manually.',
    '- Use only facts supplied here or established nRouter brand facts. Never invent metrics, prices, customers, or capabilities.',
    '- LinkedIn: strong opening, short paragraphs, useful technical detail, and no more than 5 relevant hashtags.',
    '- Instagram: concise caption, clear call to action, readable spacing, and no more than 8 relevant hashtags.',
    '- X: keep a single post within 280 characters; use a clearly numbered thread only when the idea cannot fit responsibly.',
    '- YouTube: create a concise Community post and reusable description copy. Do not create a video script, scenes, shots or generation prompt.',
    body.includeHashtags === false && '- Do not include hashtags.',
    body.includeEmojis === false && '- Do not include emojis.',
    '- Do not generate image concepts, image text, video concepts, scenes, prompts or scripts.',
    '- Label the content package as a draft for human review.',
    '- Do not add commentary before or after the campaign.',
  ].filter(Boolean).join('\n');
}

function safeError(error, apiKey) {
  const message = error instanceof Error ? error.message : String(error);
  return apiKey ? message.replaceAll(apiKey, '[redacted]') : message;
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || host}`);

    if (req.method === 'GET' && url.pathname === '/healthz') {
      return sendJson(res, 200, {
        ok: true,
        model,
        hasServerKey: Boolean(process.env.NROUTER_API_KEY),
      });
    }

    if (req.method === 'GET' && url.pathname === '/api/campaigns') {
      return sendJson(res, 200, { campaigns: await readCampaignCatalogue() });
    }

    if (req.method === 'GET' && url.pathname === '/api/schedules') {
      return sendJson(res, 200, { schedules: await refreshScheduleStatuses() });
    }

    if (req.method === 'POST' && url.pathname === '/api/schedules') {
      const body = await readJson(req);
      const content = text(body.content);
      const allowedPlatforms = new Set(['LinkedIn', 'Instagram', 'X', 'YouTube']);
      const platforms = Array.isArray(body.platforms)
        ? [...new Set(body.platforms.map(text).filter((platform) => allowedPlatforms.has(platform)))]
        : [];
      const scheduledAt = new Date(body.scheduledAt);
      if (body.approved !== true) return sendJson(res, 400, { error: 'Approve the reviewed content before scheduling it.' });
      if (!content) return sendJson(res, 400, { error: 'Generate or enter reviewed content before scheduling.' });
      if (!platforms.length) return sendJson(res, 400, { error: 'Select at least one destination.' });
      if (!Number.isFinite(scheduledAt.getTime()) || scheduledAt.getTime() <= Date.now()) {
        return sendJson(res, 400, { error: 'Choose a schedule time in the future.' });
      }

      const schedules = await readSchedules();
      const schedule = {
        id: randomUUID(),
        content,
        platforms,
        scheduledAt: scheduledAt.toISOString(),
        timezone: text(body.timezone) || 'UTC',
        status: 'scheduled',
        statusMessage: 'Approved content is queued locally.',
        createdAt: new Date().toISOString(),
      };
      schedules.push(schedule);
      await writeSchedules(schedules);
      return sendJson(res, 201, { schedule });
    }

    if (req.method === 'DELETE' && url.pathname.startsWith('/api/schedules/')) {
      const id = decodeURIComponent(url.pathname.slice('/api/schedules/'.length));
      const schedules = await readSchedules();
      const schedule = schedules.find((item) => item.id === id);
      if (!schedule) return sendJson(res, 404, { error: 'Scheduled campaign not found.' });
      if (!['scheduled', 'awaiting_connector'].includes(schedule.status)) {
        return sendJson(res, 409, { error: `A ${schedule.status} campaign cannot be cancelled.` });
      }
      schedule.status = 'cancelled';
      schedule.statusMessage = 'Cancelled locally.';
      await writeSchedules(schedules);
      return sendJson(res, 200, { schedule });
    }

    if (req.method === 'POST' && url.pathname === '/api/generate') {
      const body = await readJson(req);
      const apiKey = text(body.apiKey) || process.env.NROUTER_API_KEY;
      if (!apiKey) return sendJson(res, 400, { error: 'Enter an nRouter API key or configure NROUTER_API_KEY on the local server.' });

      let prompt;
      try { prompt = buildPrompt(body); }
      catch (error) { return sendJson(res, 400, { error: error.message }); }

      try {
        const result = await generateSocialMediaContent({
          apiKey,
          topic: prompt,
          history: Array.isArray(body.history) ? body.history.map(text).filter(Boolean).slice(-10) : [],
          maxTokens: body.includeBlog ? 6000 : 2500,
        });
        return sendJson(res, 200, {
          result,
          model,
          platforms: body.platforms,
          generatedAt: new Date().toISOString(),
          status: 'draft_for_review',
        });
      } catch (error) {
        return sendJson(res, 502, { error: safeError(error, apiKey) });
      }
    }

    const asset = assets.get(url.pathname);
    if (req.method === 'GET' && asset) {
      const [filename, contentType] = asset;
      const content = await fs.readFile(path.join(here, filename));
      res.writeHead(200, { 'content-type': contentType, 'cache-control': 'no-store' });
      res.end(content);
      return;
    }

    sendJson(res, 404, { error: 'Not found.' });
  } catch (error) {
    sendJson(res, 400, { error: error instanceof Error ? error.message : String(error) });
  }
});

server.listen(port, host, () => {
  console.log(`Social Media Studio listening on http://${host}:${port}`);
});

setInterval(() => {
  refreshScheduleStatuses().catch((error) => console.error(`Schedule refresh failed: ${error.message}`));
}, 15_000).unref();

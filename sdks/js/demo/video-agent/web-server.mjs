#!/usr/bin/env node

import { createReadStream } from 'node:fs';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildVideoPrompt } from './video-prompt-generator.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB_DIR = path.join(HERE, 'web');
const OUT_DIR = path.join(HERE, 'out');
const PORT = Number.parseInt(process.env.PORT || '4318', 10);

const TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mov': 'video/quicktime',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
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

function extensionFor(contentType) {
  const type = String(contentType || '').toLowerCase();
  if (type.includes('webm')) return 'webm';
  if (type.includes('quicktime') || type.includes('mov')) return 'mov';
  return 'mp4';
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

async function createVideo(body) {
  if (!process.env.NROUTER_API_KEY) {
    const error = new Error('Add NROUTER_API_KEY to video-agent/.env, then restart the web server.');
    error.status = 503;
    throw error;
  }

  const prompt = String(body.prompt || '').trim();
  if (!prompt) throw new Error('Generate or enter a video prompt first.');

  const { nRouter } = await import('../../dist/index.mjs');
  const client = new nRouter({
    apiKey: process.env.NROUTER_API_KEY,
    baseURL: process.env.NROUTER_BASE_URL || 'https://api.nrouter.ai/v1',
    maxRetries: 0,
  });
  const model = String(body.model || process.env.NROUTER_VIDEO_MODEL || 'sora-2').trim();
  const seconds = Number(body.seconds || process.env.NROUTER_VIDEO_SECONDS || 4);
  const size = String(body.size || process.env.NROUTER_VIDEO_SIZE || '1280x720').trim();

  const created = await client.nr.media.video({ model, prompt, seconds, size });
  const jobId = created.body?.id;
  if (typeof jobId !== 'string' || !jobId) throw new Error('The gateway accepted the request but returned no video job ID.');

  await client.nr.media.waitForVideo(jobId, {
    pollIntervalMs: Number(process.env.NROUTER_VIDEO_POLL_MS || 5_000),
    timeoutMs: Number(process.env.NROUTER_VIDEO_TIMEOUT_MS || 600_000),
  });
  const content = await client.nr.media.videoContent(jobId);
  const extension = extensionFor(content.contentType);
  const filename = `video-${Date.now()}.${extension}`;
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(path.join(OUT_DIR, filename), content.bytes);

  return {
    jobId,
    model,
    seconds,
    size,
    cost: created.meta?.cost ?? null,
    costStatus: created.meta?.costStatus ?? null,
    requestId: created.meta?.requestId ?? null,
    videoUrl: `/output/${filename}`,
  };
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || '127.0.0.1'}`);

    if (req.method === 'GET' && url.pathname === '/api/health') {
      return sendJson(res, 200, {
        ok: true,
        hasKey: Boolean(process.env.NROUTER_API_KEY),
        model: process.env.NROUTER_VIDEO_MODEL || 'sora-2',
      });
    }
    if (req.method === 'POST' && url.pathname === '/api/prompt') {
      return sendJson(res, 200, { prompt: buildVideoPrompt(await readJson(req)) });
    }
    if (req.method === 'POST' && url.pathname === '/api/video') {
      return sendJson(res, 200, await createVideo(await readJson(req)));
    }
    if (req.method === 'GET' && url.pathname.startsWith('/output/')) {
      const filename = path.basename(url.pathname);
      return await serveFile(res, path.join(OUT_DIR, filename));
    }

    const asset = url.pathname === '/' ? 'index.html' : path.basename(url.pathname);
    if (!['index.html', 'app.js', 'styles.css'].includes(asset)) return sendJson(res, 404, { error: 'Not found' });
    await serveFile(res, path.join(WEB_DIR, asset));
  } catch (error) {
    sendJson(res, error.status || 400, { error: error.message || String(error) });
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`nRouter Video Prompt Studio: http://127.0.0.1:${PORT}`);
  console.log(process.env.NROUTER_API_KEY ? 'API key loaded from the server environment.' : 'No API key found. Prompt building still works; video rendering is disabled.');
});

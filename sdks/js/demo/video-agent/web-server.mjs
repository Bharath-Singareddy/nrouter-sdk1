#!/usr/bin/env node

import assert from 'node:assert/strict';
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

function validateVideoInput({ model, prompt, seconds, size }) {
  if (!model) throw new Error('A video model is required.');
  if (!prompt) throw new Error('Generate or enter a video prompt first.');
  if (!Number.isFinite(seconds) || seconds <= 0 || seconds > 1333) {
    throw new Error('Seconds must be a number from 1 through 1333.');
  }
  const match = /^(\d+)x(\d+)$/.exec(size);
  if (!match || Number(match[1]) < 1 || Number(match[2]) < 1) {
    throw new Error('Size must use WIDTHxHEIGHT, for example 1280x720.');
  }
}

function gatewayError(payload, status) {
  return payload?.error?.message || payload?.message || `Gateway request failed (${status}).`;
}

function costFrom(headers) {
  const raw = headers.get('x-nr-request-cost');
  if (raw === null || !/^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(raw.trim())) return null;
  const value = Number(raw);
  return Number.isFinite(value) && !(value === 0 && /[1-9]/.test(raw)) ? value : null;
}

async function gatewayJson(baseUrl, key, route, options = {}) {
  const response = await fetch(`${baseUrl}${route}`, {
    ...options,
    headers: {
      authorization: `Bearer ${key}`,
      ...(options.body ? { 'content-type': 'application/json' } : {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(gatewayError(payload, response.status));
  return { payload, headers: response.headers };
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
  const model = String(body.model || process.env.NROUTER_VIDEO_MODEL || 'sora-2').trim();
  const seconds = Number(body.seconds || process.env.NROUTER_VIDEO_SECONDS || 4);
  const size = String(body.size || process.env.NROUTER_VIDEO_SIZE || '1280x720').trim();
  validateVideoInput({ model, prompt, seconds, size });

  const baseUrl = (process.env.NROUTER_BASE_URL || 'https://api.nrouter.ai/v1').replace(/\/$/, '');
  const key = process.env.NROUTER_API_KEY;
  const created = await gatewayJson(baseUrl, key, '/videos', {
    method: 'POST',
    body: JSON.stringify({ model, prompt, seconds: String(seconds), size }),
  });
  const jobId = created.payload?.id;
  if (typeof jobId !== 'string' || !jobId) throw new Error('The gateway accepted the request but returned no video job ID.');

  const pollMs = Number(process.env.NROUTER_VIDEO_POLL_MS || 5_000);
  const deadline = Date.now() + Number(process.env.NROUTER_VIDEO_TIMEOUT_MS || 600_000);
  let completed = false;
  while (Date.now() < deadline) {
    const statusResult = await gatewayJson(baseUrl, key, `/videos/${encodeURIComponent(jobId)}`);
    const status = String(statusResult.payload?.status || '').toLowerCase();
    if (status === 'completed' || status === 'succeeded') {
      completed = true;
      break;
    }
    if (status === 'failed' || status === 'cancelled') throw new Error(`Video job ended with status: ${status}.`);
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
  if (!completed) throw new Error('Timed out waiting for the video. The paid job may still be rendering; do not create a duplicate.');

  const contentResponse = await fetch(`${baseUrl}/videos/${encodeURIComponent(jobId)}/content`, {
    headers: { authorization: `Bearer ${key}` },
  });
  if (!contentResponse.ok) {
    const payload = await contentResponse.json().catch(() => ({}));
    throw new Error(gatewayError(payload, contentResponse.status));
  }
  const contentType = contentResponse.headers.get('content-type') || 'video/mp4';
  const bytes = Buffer.from(await contentResponse.arrayBuffer());
  const extension = extensionFor(contentType);
  const filename = `video-${Date.now()}.${extension}`;
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(path.join(OUT_DIR, filename), bytes);

  return {
    jobId,
    model,
    seconds,
    size,
    cost: costFrom(created.headers),
    costStatus: created.headers.get('x-nr-cost-status'),
    requestId: created.headers.get('x-nr-request-id'),
    videoUrl: `/output/${filename}`,
  };
}

function selfTest() {
  validateVideoInput({ model: 'sora-2', prompt: 'A blue circle', seconds: 4, size: '1280x720' });
  assert.throws(() => validateVideoInput({ model: '', prompt: 'x', seconds: 4, size: '1280x720' }));
  assert.throws(() => validateVideoInput({ model: 'm', prompt: 'x', seconds: 0, size: '1280x720' }));
  assert.throws(() => validateVideoInput({ model: 'm', prompt: 'x', seconds: 4, size: 'wide' }));
  assert.equal(extensionFor('video/webm'), 'webm');
  assert.equal(costFrom(new Headers({ 'x-nr-request-cost': '0' })), 0);
  assert.equal(costFrom(new Headers()), null);
  console.log('OK: video webpage server');
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

if (process.argv.includes('--self-test')) {
  selfTest();
} else {
  server.listen(PORT, '127.0.0.1', () => {
    console.log(`nRouter Video Prompt Studio: http://127.0.0.1:${PORT}`);
    console.log(process.env.NROUTER_API_KEY ? 'API key loaded from the server environment.' : 'No API key found. Prompt building still works; video rendering is disabled.');
  });
}

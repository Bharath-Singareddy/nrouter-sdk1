#!/usr/bin/env node

import assert from 'node:assert/strict';
import { parseArgs } from 'node:util';

const CONSISTENCY =
  'Keep motion physically coherent, subject identity stable, lighting consistent, and transitions smooth.';

function clean(value) {
  return value?.trim().replace(/\s+/g, ' ');
}

function buildVideoPrompt({ idea, action, scene, camera, lighting, style, mood, avoid } = {}) {
  const subject = clean(idea);
  if (!subject) throw new Error('A video idea is required.');

  return [
    subject,
    action && `Action: ${clean(action)}`,
    scene && `Scene: ${clean(scene)}`,
    camera && `Camera: ${clean(camera)}`,
    lighting && `Lighting: ${clean(lighting)}`,
    style && `Style: ${clean(style)}`,
    mood && `Mood: ${clean(mood)}`,
    CONSISTENCY,
    avoid && `Avoid: ${clean(avoid)}`,
  ]
    .filter(Boolean)
    .map((part) => (part.endsWith('.') ? part : `${part}.`))
    .join(' ');
}

function selfTest() {
  const prompt = buildVideoPrompt({
    idea: '  A paper boat on a stream  ',
    camera: 'slow tracking shot',
    lighting: 'golden hour',
    avoid: 'text, logos',
  });

  assert.match(prompt, /^A paper boat on a stream\./);
  assert.match(prompt, /Camera: slow tracking shot\./);
  assert.match(prompt, /Lighting: golden hour\./);
  assert.match(prompt, /Avoid: text, logos\.$/);
  assert.throws(() => buildVideoPrompt(), /video idea is required/i);
  console.log('OK: video prompt generator');
}

function usage() {
  console.log(`Usage:
  node video-prompt-generator.mjs "<video idea>" [options]

Options:
  --action <text>    Subject movement or event
  --scene <text>     Location and background
  --camera <text>    Shot type and camera movement
  --lighting <text>  Lighting and time of day
  --style <text>     Visual treatment
  --mood <text>      Emotional tone
  --avoid <text>     Elements to exclude
  --self-test        Run the local check
  --help             Show this help

Example:
  node video-prompt-generator.mjs "A red fox crossing a snowy forest" \\
    --camera "slow side-tracking shot" --lighting "soft winter dawn" \\
    --style "cinematic photorealism" --mood "quiet and curious" \\
    --avoid "text, logos, sudden cuts"`);
}

function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      action: { type: 'string' },
      scene: { type: 'string' },
      camera: { type: 'string' },
      lighting: { type: 'string' },
      style: { type: 'string' },
      mood: { type: 'string' },
      avoid: { type: 'string' },
      'self-test': { type: 'boolean' },
      help: { type: 'boolean', short: 'h' },
    },
  });

  if (values.help) return usage();
  if (values['self-test']) return selfTest();

  try {
    console.log(buildVideoPrompt({ idea: positionals.join(' '), ...values }));
  } catch (error) {
    console.error(error.message);
    usage();
    process.exitCode = 1;
  }
}

main();

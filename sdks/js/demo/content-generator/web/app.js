const $ = (selector) => document.querySelector(selector);

async function request(url, options) {
  const response = await fetch(url, options);
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || `Request failed (${response.status})`);
  return body;
}

async function checkHealth() {
  try {
    const health = await request('/api/health');
    $('#keyStatus').textContent = health.hasKey ? 'API key ready' : 'API key missing';
    $('#keyStatus').classList.toggle('ready', health.hasKey);
    $('#generateBtn').disabled = !health.hasKey;
    $('#model').value = health.model;
  } catch (error) {
    $('#keyStatus').textContent = error.message;
  }
}

async function buildBrief() {
  const fields = Object.fromEntries(new FormData($('#contentForm')));
  const result = await request('/api/prompt', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(fields),
  });
  $('#prompt').value = result.prompt;
}

$('#contentForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    await buildBrief();
    $('#message').textContent = 'Content brief ready. Review it, then generate.';
  } catch (error) {
    $('#message').textContent = error.message;
  }
});

async function copyFrom(selector, button) {
  const text = $(selector).value.trim();
  if (!text) return;
  await navigator.clipboard.writeText(text);
  const original = button.textContent;
  button.textContent = 'Copied';
  setTimeout(() => (button.textContent = original), 1200);
}

$('#copyPromptBtn').addEventListener('click', (event) => copyFrom('#prompt', event.currentTarget));
$('#copyBtn').addEventListener('click', (event) => copyFrom('#output', event.currentTarget));

$('#downloadBtn').addEventListener('click', () => {
  const blob = new Blob([$('#output').value], { type: 'text/plain;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'nrouter-content.txt';
  link.click();
  URL.revokeObjectURL(link.href);
});

$('#generateBtn').addEventListener('click', async () => {
  let prompt = $('#prompt').value.trim();
  if (!prompt) {
    try { await buildBrief(); prompt = $('#prompt').value.trim(); }
    catch (error) { return ($('#message').textContent = error.message); }
  }
  if (!window.confirm('This sends one billed text-generation request. Continue?')) return;

  const button = $('#generateBtn');
  button.disabled = true;
  $('#message').textContent = 'Generating content…';
  try {
    const result = await request('/api/content', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt, model: $('#model').value, maxTokens: Number($('#maxTokens').value) }),
    });
    $('#output').value = result.content;
    $('#meta').textContent = JSON.stringify({ model: result.model, usage: result.usage, cost: result.cost, costStatus: result.costStatus, requestId: result.requestId, protectedEmailCount: result.protectedEmailCount }, null, 2);
    $('#outputCard').hidden = false;
    $('#message').textContent = 'Content generated successfully.';
    $('#outputCard').scrollIntoView({ behavior: 'smooth' });
  } catch (error) {
    $('#message').textContent = error.message;
  } finally {
    button.disabled = false;
  }
});

checkHealth();

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
    $('#renderBtn').disabled = !health.hasKey;
    $('#model').value = health.model;
  } catch (error) {
    $('#keyStatus').textContent = error.message;
  }
}

$('#promptForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const fields = Object.fromEntries(new FormData(event.currentTarget));
  try {
    const result = await request('/api/prompt', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(fields),
    });
    $('#generatedPrompt').value = result.prompt;
  } catch (error) {
    $('#message').textContent = error.message;
  }
});

$('#copyBtn').addEventListener('click', async () => {
  const prompt = $('#generatedPrompt').value.trim();
  if (!prompt) return;
  await navigator.clipboard.writeText(prompt);
  $('#copyBtn').textContent = 'Copied';
  setTimeout(() => ($('#copyBtn').textContent = 'Copy'), 1200);
});

$('#renderBtn').addEventListener('click', async () => {
  const prompt = $('#generatedPrompt').value.trim();
  if (!prompt) return ($('#message').textContent = 'Build or enter a prompt first.');
  if (!window.confirm('This starts a billed video generation request. Continue?')) return;

  const button = $('#renderBtn');
  button.disabled = true;
  $('#video').hidden = true;
  $('#meta').hidden = true;
  $('#message').textContent = 'Rendering… this can take several minutes. Keep this page open.';

  try {
    const result = await request('/api/video', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        prompt,
        model: $('#model').value,
        seconds: Number($('#seconds').value),
        size: $('#size').value,
      }),
    });
    $('#video').src = result.videoUrl;
    $('#video').hidden = false;
    $('#meta').textContent = JSON.stringify(result, null, 2);
    $('#meta').hidden = false;
    $('#message').textContent = 'Video completed.';
  } catch (error) {
    $('#message').textContent = error.message;
  } finally {
    button.disabled = false;
  }
});

checkHealth();

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
let generatedPlatforms = [];

async function request(url, options = {}) {
  const response = await fetch(url, options);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `Request failed (${response.status})`);
  return body;
}

function setHealth(className, label) {
  const health = $('#health');
  health.className = `status ${className}`;
  health.replaceChildren(document.createElement('i'), document.createTextNode(label));
}

async function checkHealth() {
  try {
    const health = await request('/healthz');
    setHealth('ready', `Agent ready · ${health.model}`);
    if (health.hasServerKey) $('#apiKey').placeholder = 'Local server key is ready — optional override';
  } catch {
    setHealth('error', 'Agent unavailable');
  }
}

async function loadCampaigns() {
  try {
    const { campaigns } = await request('/api/campaigns');
    campaigns.forEach((campaign) => {
      const option = document.createElement('option');
      option.value = campaign.campaign_id;
      option.textContent = campaign.topic;
      option.dataset.prompt = campaign.user_prompt;
      $('#campaignTemplate').append(option);
    });
  } catch {
    const option = document.createElement('option');
    option.disabled = true;
    option.textContent = 'Campaign catalogue unavailable';
    $('#campaignTemplate').append(option);
  }
}

function selectedPlatforms() {
  return $$('input[name="platforms"]:checked').map((input) => input.value);
}

function setLoading(loading) {
  $('#generateBtn').disabled = loading;
  $('#emptyState').hidden = true;
  $('#resultState').hidden = true;
  $('#loadingState').hidden = !loading;
  if (loading) resetApproval();
}

function resetApproval() {
  $('#approvalCheck').checked = false;
  $('#approvalCheck').disabled = !$('#output').value.trim();
  $('#scheduleAt').disabled = true;
  $('#scheduleBtn').disabled = true;
}

function setDefaultScheduleTime() {
  const now = new Date();
  const nextHour = new Date(now.getTime() + 60 * 60 * 1000);
  nextHour.setMinutes(0, 0, 0);
  const localValue = new Date(nextHour.getTime() - nextHour.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  const minimumValue = new Date(now.getTime() - now.getTimezoneOffset() * 60_000 + 60_000).toISOString().slice(0, 16);
  $('#scheduleAt').value = localValue;
  $('#scheduleAt').min = minimumValue;
  $('#timezone').value = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Local time';
}

function showResult(data) {
  const output = data.result || '';
  $('#loadingState').hidden = true;
  $('#resultState').hidden = false;
  $('#output').value = output;
  $('#copyBtn').disabled = !output;
  $('#downloadBtn').disabled = !output;
  generatedPlatforms = [...data.platforms];
  $('#approvalCheck').disabled = !output;
  resetApproval();

  const meta = $('#resultMeta');
  meta.replaceChildren();
  [data.model, ...data.platforms, new Date(data.generatedAt).toLocaleString()].forEach((item) => {
    const pill = document.createElement('span');
    pill.textContent = item;
    meta.append(pill);
  });
}

function resetCampaign() {
  $('#campaignForm').reset();
  $('#audience').value = 'AI developers and engineering teams';
  $('#ideaCount').textContent = '0 / 600';
  $$('.platform').forEach((label) => label.classList.toggle('selected', label.querySelector('input').checked));
  $('#output').value = '';
  $('#emptyState').hidden = false;
  $('#loadingState').hidden = true;
  $('#resultState').hidden = true;
  $('#copyBtn').disabled = true;
  $('#downloadBtn').disabled = true;
  $('#formMessage').textContent = '';
  $('#articleLengthField').hidden = true;
  generatedPlatforms = [];
  resetApproval();
}

function statusLabel(status) {
  return status.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function renderSchedules(schedules) {
  const list = $('#scheduleList');
  list.replaceChildren();
  if (!schedules.length) {
    const empty = document.createElement('p');
    empty.className = 'queue-empty';
    empty.textContent = 'No campaigns scheduled.';
    list.append(empty);
    return;
  }

  [...schedules].sort((left, right) => Date.parse(left.scheduledAt) - Date.parse(right.scheduledAt)).forEach((schedule) => {
    const item = document.createElement('article');
    item.className = 'schedule-item';
    const head = document.createElement('div');
    head.className = 'schedule-item-head';
    const details = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = schedule.platforms.join(', ');
    const timing = document.createElement('small');
    timing.textContent = `${new Date(schedule.scheduledAt).toLocaleString()} · ${schedule.timezone}`;
    details.append(title, timing);
    const badge = document.createElement('span');
    badge.className = `schedule-status ${schedule.status}`;
    badge.textContent = statusLabel(schedule.status);
    head.append(details, badge);
    item.append(head);
    const message = document.createElement('small');
    message.textContent = schedule.statusMessage;
    item.append(message);
    if (['scheduled', 'awaiting_connector'].includes(schedule.status)) {
      const cancel = document.createElement('button');
      cancel.type = 'button';
      cancel.className = 'cancel-schedule';
      cancel.textContent = 'Cancel schedule';
      cancel.addEventListener('click', () => cancelSchedule(schedule.id));
      item.append(cancel);
    }
    list.append(item);
  });
}

async function loadSchedules() {
  try {
    const { schedules } = await request('/api/schedules');
    renderSchedules(schedules);
  } catch (error) {
    $('#scheduleMessage').className = 'form-message error';
    $('#scheduleMessage').textContent = error.message;
  }
}

async function cancelSchedule(id) {
  try {
    await request(`/api/schedules/${encodeURIComponent(id)}`, { method: 'DELETE' });
    $('#scheduleMessage').className = 'form-message';
    $('#scheduleMessage').textContent = 'Scheduled campaign cancelled.';
    await loadSchedules();
  } catch (error) {
    $('#scheduleMessage').className = 'form-message error';
    $('#scheduleMessage').textContent = error.message;
  }
}

$('#campaignTemplate').addEventListener('change', (event) => {
  const option = event.target.selectedOptions[0];
  if (!option?.dataset.prompt) return;
  $('#idea').value = option.dataset.prompt;
  $('#ideaCount').textContent = `${option.dataset.prompt.length} / 600`;
});

$('#includeBlog').addEventListener('change', (event) => {
  $('#articleLengthField').hidden = !event.target.checked;
});

$('#idea').addEventListener('input', (event) => {
  $('#ideaCount').textContent = `${event.target.value.length} / 600`;
});

$('#toggleKey').addEventListener('click', () => {
  const key = $('#apiKey');
  key.type = key.type === 'password' ? 'text' : 'password';
  $('#toggleKey').textContent = key.type === 'password' ? 'Show' : 'Hide';
});

$$('.platform input').forEach((input) => input.addEventListener('change', () => {
  input.closest('.platform').classList.toggle('selected', input.checked);
}));

$('#campaignForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const platforms = selectedPlatforms();
  if (!platforms.length) {
    $('#formMessage').className = 'form-message error';
    $('#formMessage').textContent = 'Select at least one destination.';
    return;
  }
  if (!window.confirm('Generate this campaign now? One nRouter request will use credits.')) return;

  const form = new FormData(event.currentTarget);
  const body = {
    apiKey: form.get('apiKey'),
    idea: form.get('idea'),
    contentType: form.get('contentType'),
    goal: form.get('goal'),
    audience: form.get('audience'),
    tone: form.get('tone'),
    platforms,
    variations: Number(form.get('variations')),
    sourceUrl: form.get('sourceUrl'),
    callToAction: form.get('callToAction'),
    keyPoints: form.get('keyPoints'),
    includeHashtags: $('#includeHashtags').checked,
    includeEmojis: $('#includeEmojis').checked,
    includeBlog: $('#includeBlog').checked,
    articleLength: $('#articleLength').value,
  };

  setLoading(true);
  $('#formMessage').className = 'form-message';
  $('#formMessage').textContent = 'Generating platform-specific drafts…';
  try {
    const result = await request('/api/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    showResult(result);
    $('#formMessage').textContent = 'Content package generated. Review and edit it, then approve the exact copy for scheduling.';
  } catch (error) {
    $('#loadingState').hidden = true;
    $('#emptyState').hidden = false;
    $('#formMessage').className = 'form-message error';
    $('#formMessage').textContent = error.message;
  } finally {
    $('#generateBtn').disabled = false;
  }
});

$('#copyBtn').addEventListener('click', async () => {
  await navigator.clipboard.writeText($('#output').value);
  const button = $('#copyBtn');
  button.textContent = 'Copied';
  setTimeout(() => (button.textContent = 'Copy'), 1200);
});

$('#downloadBtn').addEventListener('click', () => {
  const blob = new Blob([$('#output').value], { type: 'text/markdown;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `nrouter-social-campaign-${new Date().toISOString().slice(0, 10)}.md`;
  link.click();
  URL.revokeObjectURL(link.href);
});

$('#output').addEventListener('input', resetApproval);
$('#approvalCheck').addEventListener('change', (event) => {
  const approved = event.target.checked;
  $('#scheduleAt').disabled = !approved;
  $('#scheduleBtn').disabled = !approved || !$('#output').value.trim() || !generatedPlatforms.length;
});

$('#scheduleBtn').addEventListener('click', async () => {
  const value = $('#scheduleAt').value;
  const scheduledAt = value ? new Date(value) : null;
  if (!scheduledAt || !Number.isFinite(scheduledAt.getTime())) {
    $('#scheduleMessage').className = 'form-message error';
    $('#scheduleMessage').textContent = 'Choose a valid future date and time.';
    return;
  }

  $('#scheduleBtn').disabled = true;
  $('#scheduleMessage').className = 'form-message';
  $('#scheduleMessage').textContent = 'Adding approved content to the local queue…';
  try {
    const { schedule } = await request('/api/schedules', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        approved: $('#approvalCheck').checked,
        content: $('#output').value,
        platforms: generatedPlatforms,
        scheduledAt: scheduledAt.toISOString(),
        timezone: $('#timezone').value,
      }),
    });
    $('#scheduleMessage').textContent = `Scheduled for ${new Date(schedule.scheduledAt).toLocaleString()}.`;
    resetApproval();
    await loadSchedules();
  } catch (error) {
    $('#scheduleMessage').className = 'form-message error';
    $('#scheduleMessage').textContent = error.message;
    $('#scheduleBtn').disabled = !$('#approvalCheck').checked;
  }
});

$('#resetBtn').addEventListener('click', resetCampaign);
$('#refreshQueueBtn').addEventListener('click', loadSchedules);
document.addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') $('#campaignForm').requestSubmit();
});

checkHealth();
loadCampaigns();
setDefaultScheduleTime();
loadSchedules();

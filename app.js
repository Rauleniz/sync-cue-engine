// ── State ──────────────────────────────────────────────────────────────────

const state = {
  player: null,
  audioURL: null,
  audioDuration: 0,
  isPlaying: false,
  cues: [],
};

let cueIdCounter     = 0;
let pendingCueEvents = [];
let indicatorTimer   = null;

// ── DOM ────────────────────────────────────────────────────────────────────

const $ = id => document.getElementById(id);

const audioInput     = $('audio-input');
const audioName      = $('audio-name');
const audioDur       = $('audio-dur');
const cueList        = $('cue-list');
const addCueBtn      = $('add-cue-btn');
const playBtn        = $('play-btn');
const stopBtn        = $('stop-btn');
const transportClock = $('transport-clock');
const transportLabel = $('transport-label');
const cueLog         = $('cue-log');
const cueIndicator   = $('cue-indicator');
const indCueLabel    = $('ind-cue-label');
const indDevValue    = $('ind-dev-value');
const monitorStatus  = $('monitor-status');

// ── Time utilities ─────────────────────────────────────────────────────────

function parseTime(str) {
  const s = str.replace(/(\d{2}):(\d{3})$/, '$1.$2');
  const m = s.match(/^(\d+):(\d{2})\.(\d{1,3})$/);
  if (!m) return NaN;
  return +m[1] * 60 + +m[2] + +m[3].padEnd(3,'0') / 1000;
}

function formatTime(sec) {
  if (!isFinite(sec) || sec < 0) sec = 0;
  const mm = Math.floor(sec / 60);
  const ss = Math.floor(sec % 60);
  const ms = Math.floor((sec % 1) * 1000);
  return `${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}.${String(ms).padStart(3,'0')}`;
}

// ── Cue firing (runs inside animation frame — safe to touch DOM) ───────────

function fireCue(cue, deviationMs) {
  const sign = deviationMs >= 0 ? '+' : '';
  const abs  = Math.abs(deviationMs);

  indCueLabel.textContent = cue.label || '—';
  indDevValue.textContent = `${sign}${deviationMs.toFixed(2)}`;
  indDevValue.style.color = abs < 5 ? 'var(--ok)' : abs < 20 ? 'var(--warn)' : 'var(--danger)';

  // Re-trigger CSS flash animation
  cueIndicator.classList.remove('fire');
  void cueIndicator.offsetWidth;
  cueIndicator.classList.add('fire');
  clearTimeout(indicatorTimer);
  indicatorTimer = setTimeout(() => cueIndicator.classList.remove('fire'), 900);

  document.querySelectorAll('#cue-list tr').forEach(r => r.classList.remove('active'));
  const row = document.querySelector(`#cue-list tr[data-id="${cue.id}"]`);
  if (row) row.classList.add('active');

  const entry = document.createElement('div');
  entry.className = 'log-entry';
  entry.textContent = `▸ ${formatTime(cue.timeSeconds)}  ${cue.label}  ${sign}${deviationMs.toFixed(2)} ms`;
  cueLog.prepend(entry);
  while (cueLog.children.length > 6) cueLog.lastChild.remove();
}

// ── Cue scheduling ─────────────────────────────────────────────────────────

function scheduleCues() {
  Tone.Transport.cancel();
  pendingCueEvents = [];

  state.cues.forEach(cue => {
    if (!isFinite(cue.timeSeconds) || cue.timeSeconds < 0) return;
    Tone.Transport.schedule((time) => {
      const deviationMs = (Tone.context.currentTime - time) * 1000;
      pendingCueEvents.push({ cue, deviationMs });
    }, cue.timeSeconds);
  });

  if (state.audioDuration > 0) {
    Tone.Transport.schedule(() => {
      pendingCueEvents.push({ stopSignal: true });
    }, state.audioDuration + 0.3);
  }
}

// ── Transport ──────────────────────────────────────────────────────────────

async function play() {
  await Tone.start();

  Tone.Transport.stop();
  Tone.Transport.position = 0;
  resetMonitor();
  scheduleCues();

  const t0 = Tone.now() + 0.1;
  if (state.player) state.player.start(t0);
  Tone.Transport.start(t0);

  state.isPlaying = true;
  playBtn.disabled = true;
  stopBtn.disabled = false;
  transportLabel.textContent = 'PLAYING';
  transportLabel.classList.add('playing');
  monitorStatus.textContent = 'PLAYING';
  monitorStatus.classList.add('playing');
}

function stop() {
  Tone.Transport.stop();
  Tone.Transport.cancel();
  pendingCueEvents = [];

  if (state.player) { try { state.player.stop(); } catch (_) {} }

  state.isPlaying = false;
  playBtn.disabled = !state.player;
  stopBtn.disabled = true;
  transportClock.textContent = '00:00.000';
  transportLabel.textContent = 'STOPPED';
  transportLabel.classList.remove('playing');
  monitorStatus.textContent = 'STANDBY';
  monitorStatus.classList.remove('playing');
  document.querySelectorAll('#cue-list tr').forEach(r => r.classList.remove('active'));
}

function resetMonitor() {
  indCueLabel.textContent = '—';
  indDevValue.textContent = '—';
  indDevValue.style.color = 'var(--accent)';
  cueLog.innerHTML = '';
  cueIndicator.classList.remove('fire');
}

// ── Animation loop ─────────────────────────────────────────────────────────

function animate() {
  pendingCueEvents.splice(0).forEach(ev => {
    if (ev.stopSignal) { stop(); return; }
    fireCue(ev.cue, ev.deviationMs);
  });

  if (state.isPlaying && Tone.Transport.state === 'started') {
    transportClock.textContent = formatTime(Tone.Transport.seconds);
  }

  requestAnimationFrame(animate);
}

// ── Audio loading ──────────────────────────────────────────────────────────

audioInput.addEventListener('change', async e => {
  const file = e.target.files[0];
  if (!file) return;
  await Tone.start();

  if (state.player) {
    try { state.player.stop(); } catch (_) {}
    state.player.disconnect();
    state.player.dispose();
    state.player = null;
  }
  if (state.audioURL) { URL.revokeObjectURL(state.audioURL); state.audioURL = null; }

  audioName.textContent = 'Loading…';
  audioDur.textContent  = '';
  playBtn.disabled = true;

  state.audioURL = URL.createObjectURL(file);
  const player = new Tone.Player({
    url: state.audioURL,
    onload: () => {
      state.audioDuration = player.buffer.duration;
      state.player = player;
      audioName.textContent = file.name;
      audioDur.textContent  = formatTime(state.audioDuration);
      playBtn.disabled = false;
    },
    onerror: err => {
      audioName.textContent = 'Error loading file';
      console.error(err);
    },
  }).toDestination();
});

// ── Cue sheet ──────────────────────────────────────────────────────────────

function addCue(def = {}) {
  const cue = {
    id: cueIdCounter++,
    timeStr: def.timeStr || '00:00.000',
    timeSeconds: isFinite(def.timeSeconds) ? def.timeSeconds : 0,
    label: def.label || 'CUE',
  };
  state.cues.push(cue);
  renderCueRow(cue);
}

function renderCueRow(cue) {
  const tr = document.createElement('tr');
  tr.dataset.id = cue.id;
  tr.innerHTML = `
    <td><input class="cue-time-input" type="text" value="${cue.timeStr}" spellcheck="false"></td>
    <td><input class="cue-label-input" type="text" value="${cue.label.replace(/"/g,'&quot;')}" spellcheck="false" maxlength="24"></td>
    <td><button class="del-btn" title="Delete">&#10005;</button></td>
  `;

  const timeInput  = tr.querySelector('.cue-time-input');
  const labelInput = tr.querySelector('.cue-label-input');

  timeInput.addEventListener('blur', () => {
    const t = parseTime(timeInput.value);
    if (isNaN(t)) {
      timeInput.classList.add('error');
    } else {
      timeInput.classList.remove('error');
      cue.timeStr     = timeInput.value;
      cue.timeSeconds = t;
      sortCues();
    }
  });

  labelInput.addEventListener('input', () => { cue.label = labelInput.value; });

  tr.querySelector('.del-btn').addEventListener('click', () => {
    state.cues = state.cues.filter(c => c.id !== cue.id);
    tr.remove();
  });

  cueList.appendChild(tr);
}

function sortCues() {
  state.cues.sort((a, b) => a.timeSeconds - b.timeSeconds);
  state.cues.forEach(cue => {
    const row = cueList.querySelector(`[data-id="${cue.id}"]`);
    if (row) cueList.appendChild(row);
  });
}

// ── Event listeners ────────────────────────────────────────────────────────

addCueBtn.addEventListener('click', () => addCue());
playBtn.addEventListener('click', play);
stopBtn.addEventListener('click', stop);

// ── Demo cues ──────────────────────────────────────────────────────────────

[
  { timeStr:'00:01.000', label:'INTRO'      },
  { timeStr:'00:03.000', label:'MARK A'     },
  { timeStr:'00:05.000', label:'CUE 01'     },
  { timeStr:'00:07.000', label:'PEAK'       },
  { timeStr:'00:09.000', label:'OUTRO'      },
].forEach(d => addCue({ ...d, timeSeconds: parseTime(d.timeStr) }));

// ── Start ──────────────────────────────────────────────────────────────────

requestAnimationFrame(animate);

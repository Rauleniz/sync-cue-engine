// ── State ──────────────────────────────────────────────────────────────────

const state = {
  player: null,
  audioURL: null,
  audioDuration: 0,
  isPlaying: false,
  cues: [],
};

let cueIdCounter  = 0;
let pendingCueEvents = []; // queue: audio scheduler → animation frame → DOM

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
const devValue       = $('dev-value');
const cueLog         = $('cue-log');
const stageCanvas    = $('stage');
const stageLabel     = $('stage-label');
const stageStatus    = $('stage-status');
const editOverlay    = $('edit-overlay');
const editSaveBtn    = $('edit-save');
const editCancelBtn  = $('edit-cancel');

const ctx = stageCanvas.getContext('2d');

// ── Drone formations (normalized 0–1) ──────────────────────────────────────

const FORMATIONS = {
  grid: [
    {x:.2,y:.2},{x:.5,y:.2},{x:.8,y:.2},
    {x:.2,y:.5},{x:.5,y:.5},{x:.8,y:.5},
    {x:.2,y:.8},{x:.5,y:.8},{x:.8,y:.8},
  ],
  circle: Array.from({length:9}, (_,i) => ({
    x: .5 + .38 * Math.cos(i * 2*Math.PI/9 - Math.PI/2),
    y: .5 + .38 * Math.sin(i * 2*Math.PI/9 - Math.PI/2),
  })),
  line:   Array.from({length:9}, (_,i) => ({ x: .1 + i*.1, y: .5 })),
  vline:  Array.from({length:9}, (_,i) => ({ x: .5, y: .1 + i*.1 })),
  scatter:[
    {x:.15,y:.22},{x:.38,y:.75},{x:.62,y:.18},{x:.83,y:.62},{x:.44,y:.88},
    {x:.71,y:.12},{x:.23,y:.54},{x:.90,y:.36},{x:.5,y:.5},
  ],
};

// ── Drone render state ─────────────────────────────────────────────────────

let drones = FORMATIONS.grid.map(p => ({
  x: p.x, y: p.y,    // current (animated) position
  tx: p.x, ty: p.y,  // target position
  color: '#00d4ff',
  phase: Math.random() * Math.PI * 2,
}));

let flashAmt = 0; // 0–1, decays each frame

// ── Edit mode state ────────────────────────────────────────────────────────

let editMode = null;      // null | { cueId, savedPositions, rebuildFn }
let draggingDrone = null; // index | null
let hoveredDrone  = -1;   // index | -1

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

// ── Canvas resize ──────────────────────────────────────────────────────────

function resizeCanvas() {
  stageCanvas.width  = stageCanvas.offsetWidth;
  stageCanvas.height = stageCanvas.offsetHeight;
}
new ResizeObserver(resizeCanvas).observe(stageCanvas);
resizeCanvas();

// ── Canvas coordinate helper ───────────────────────────────────────────────

function canvasPos(e) {
  const r = stageCanvas.getBoundingClientRect();
  return {
    x: (e.clientX - r.left) * (stageCanvas.width  / r.width),
    y: (e.clientY - r.top)  * (stageCanvas.height / r.height),
  };
}

function findDroneNear(px, py, threshold = 36) {
  const W = stageCanvas.width, H = stageCanvas.height;
  let best = -1, bestD = threshold;
  drones.forEach((d, i) => {
    const dx = d.x * W - px, dy = d.y * H - py;
    const dist = Math.sqrt(dx*dx + dy*dy);
    if (dist < bestD) { bestD = dist; best = i; }
  });
  return best;
}

// ── Edit mode ──────────────────────────────────────────────────────────────

function enterEditMode(cue, rebuildFn) {
  if (state.isPlaying) return;

  // Snapshot current positions to restore on cancel
  const savedPositions = drones.map(d => ({ x: d.x, y: d.y }));

  // Move drones to cue's saved positions (or grid if not yet set)
  let positions = null;
  try { positions = JSON.parse(cue.value); } catch (_) {}
  const src = (Array.isArray(positions) && positions.length === 9)
    ? positions
    : FORMATIONS.grid;

  drones.forEach((d, i) => {
    d.x = src[i].x; d.y = src[i].y;
    d.tx = src[i].x; d.ty = src[i].y;
  });

  editMode = { cueId: cue.id, savedPositions, rebuildFn };
  editOverlay.classList.remove('hidden');
  stageStatus.textContent = '9 drones · EDIT MODE';
}

function exitEditMode(save) {
  if (!editMode) return;

  if (save) {
    const positions = drones.map(d => ({
      x: parseFloat(d.x.toFixed(4)),
      y: parseFloat(d.y.toFixed(4)),
    }));
    const cue = state.cues.find(c => c.id === editMode.cueId);
    if (cue) {
      cue.value = JSON.stringify(positions);
      editMode.rebuildFn(); // refresh the value cell button label
    }
  } else {
    editMode.savedPositions.forEach((p, i) => {
      drones[i].x = p.x; drones[i].y = p.y;
      drones[i].tx = p.x; drones[i].ty = p.y;
    });
  }

  editMode      = null;
  draggingDrone = null;
  hoveredDrone  = -1;
  stageCanvas.style.cursor = '';
  editOverlay.classList.add('hidden');
  stageStatus.textContent = '9 drones · idle';
}

// ── Canvas mouse events (only active during edit mode) ────────────────────

stageCanvas.addEventListener('mousedown', e => {
  if (!editMode) return;
  const { x, y } = canvasPos(e);
  const idx = findDroneNear(x, y);
  if (idx >= 0) {
    draggingDrone = idx;
    stageCanvas.style.cursor = 'grabbing';
  }
});

stageCanvas.addEventListener('mousemove', e => {
  if (!editMode) return;
  const { x, y } = canvasPos(e);
  const W = stageCanvas.width, H = stageCanvas.height;

  if (draggingDrone !== null) {
    drones[draggingDrone].x  = Math.max(.02, Math.min(.98, x / W));
    drones[draggingDrone].y  = Math.max(.02, Math.min(.98, y / H));
    drones[draggingDrone].tx = drones[draggingDrone].x;
    drones[draggingDrone].ty = drones[draggingDrone].y;
  } else {
    hoveredDrone = findDroneNear(x, y);
    stageCanvas.style.cursor = hoveredDrone >= 0 ? 'grab' : 'crosshair';
  }
});

stageCanvas.addEventListener('mouseup', () => {
  if (!editMode) return;
  draggingDrone = null;
  stageCanvas.style.cursor = hoveredDrone >= 0 ? 'grab' : 'crosshair';
});

stageCanvas.addEventListener('mouseleave', () => {
  draggingDrone = null;
  hoveredDrone  = -1;
});

// ── Cue firing (runs inside animation frame — safe to touch DOM) ───────────

function fireCue(cue, deviationMs) {
  const sign = deviationMs >= 0 ? '+' : '';
  devValue.textContent = `${sign}${deviationMs.toFixed(2)}`;
  const abs = Math.abs(deviationMs);
  devValue.style.color = abs < 5 ? 'var(--ok)' : abs < 20 ? 'var(--warn)' : 'var(--danger)';

  document.querySelectorAll('#cue-list tr').forEach(r => r.classList.remove('active'));
  const row = document.querySelector(`#cue-list tr[data-id="${cue.id}"]`);
  if (row) row.classList.add('active');

  const entry = document.createElement('div');
  entry.className = 'log-entry';
  entry.textContent = `▸ ${formatTime(cue.timeSeconds)} · ${cue.type}: ${cue.value.toString().slice(0,20)} · ${sign}${deviationMs.toFixed(2)} ms`;
  cueLog.prepend(entry);
  while (cueLog.children.length > 6) cueLog.lastChild.remove();

  switch (cue.type) {
    case 'color':
      drones.forEach(d => d.color = cue.value);
      stageStatus.textContent = `9 drones · color ${cue.value}`;
      break;

    case 'formation': {
      const f = FORMATIONS[cue.value];
      if (f) {
        drones.forEach((d,i) => { d.tx = f[i].x; d.ty = f[i].y; });
        stageStatus.textContent = `9 drones · ${cue.value}`;
      }
      break;
    }

    case 'custom': {
      try {
        const pos = JSON.parse(cue.value);
        if (Array.isArray(pos) && pos.length === 9) {
          drones.forEach((d,i) => { d.tx = pos[i].x; d.ty = pos[i].y; });
          stageStatus.textContent = `9 drones · custom`;
        }
      } catch (_) {}
      break;
    }

    case 'text':
      stageLabel.textContent = cue.value;
      stageLabel.style.opacity = '1';
      clearTimeout(stageLabel._t);
      stageLabel._t = setTimeout(() => { stageLabel.style.opacity = '0'; }, 2500);
      stageStatus.textContent = `9 drones · text cue`;
      break;

    case 'flash':
      flashAmt = 1;
      stageStatus.textContent = `9 drones · flash`;
      break;
  }
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
  resetStage();
  scheduleCues();

  const t0 = Tone.now() + 0.1;
  if (state.player) state.player.start(t0);
  Tone.Transport.start(t0);

  state.isPlaying = true;
  playBtn.disabled = true;
  stopBtn.disabled = false;
  transportLabel.textContent = 'PLAYING';
  transportLabel.classList.add('playing');
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
  document.querySelectorAll('#cue-list tr').forEach(r => r.classList.remove('active'));
}

function resetStage() {
  const g = FORMATIONS.grid;
  drones.forEach((d,i) => {
    d.x = g[i].x; d.y = g[i].y;
    d.tx = g[i].x; d.ty = g[i].y;
    d.color = '#00d4ff';
  });
  flashAmt = 0;
  stageLabel.textContent = '';
  stageLabel.style.opacity = '0';
  devValue.textContent = '—';
  devValue.style.color = 'var(--accent)';
  cueLog.innerHTML = '';
  stageStatus.textContent = '9 drones · idle';
}

// ── Animation / render loop ────────────────────────────────────────────────

let lastTs = 0;

function animate(ts) {
  const dt = Math.min((ts - lastTs) / 1000, 0.05);
  lastTs = ts;

  pendingCueEvents.splice(0).forEach(ev => {
    if (ev.stopSignal) { stop(); return; }
    fireCue(ev.cue, ev.deviationMs);
  });

  if (state.isPlaying && Tone.Transport.state === 'started') {
    transportClock.textContent = formatTime(Tone.Transport.seconds);
  }

  draw(ts, dt);
  requestAnimationFrame(animate);
}

function draw(ts, dt) {
  const W = stageCanvas.width;
  const H = stageCanvas.height;

  ctx.fillStyle = '#0a0a18';
  ctx.fillRect(0, 0, W, H);

  // Subtle grid
  ctx.strokeStyle = 'rgba(255,255,255,.035)';
  ctx.lineWidth = 1;
  for (let i = 1; i < 6; i++) {
    ctx.beginPath(); ctx.moveTo(W*i/6,0); ctx.lineTo(W*i/6,H); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0,H*i/6); ctx.lineTo(W,H*i/6); ctx.stroke();
  }

  // Drones
  drones.forEach((d, i) => {
    // Skip lerp while dragging this drone
    if (draggingDrone !== i) {
      d.x += (d.tx - d.x) * Math.min(dt * 5, 1);
      d.y += (d.ty - d.y) * Math.min(dt * 5, 1);
    }

    const px = d.x * W;
    const py = d.y * H;
    const pulse = .75 + .25 * Math.sin(ts * .0025 + d.phase);
    const R = 9 * pulse;

    // Glow halo
    const grd = ctx.createRadialGradient(px, py, 0, px, py, R * 5);
    grd.addColorStop(0, d.color + 'aa');
    grd.addColorStop(1, 'transparent');
    ctx.fillStyle = grd;
    ctx.beginPath(); ctx.arc(px, py, R*5, 0, Math.PI*2); ctx.fill();

    // Core dot
    ctx.fillStyle = d.color;
    ctx.beginPath(); ctx.arc(px, py, R, 0, Math.PI*2); ctx.fill();

    // Bright centre
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    ctx.beginPath(); ctx.arc(px, py, R*.28, 0, Math.PI*2); ctx.fill();

    // Edit mode: selection ring + drone index
    if (editMode) {
      const isActive = (i === draggingDrone || i === hoveredDrone);
      ctx.strokeStyle = isActive ? '#ffffff' : 'rgba(123,77,255,.6)';
      ctx.lineWidth   = isActive ? 2 : 1;
      ctx.beginPath(); ctx.arc(px, py, 22, 0, Math.PI*2); ctx.stroke();

      ctx.fillStyle = isActive ? '#ffffff' : 'rgba(255,255,255,.45)';
      ctx.font = '10px Courier New';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(i + 1, px, py - 30);
    }
  });

  // Flash overlay
  if (flashAmt > 0) {
    ctx.fillStyle = `rgba(255,255,255,${flashAmt.toFixed(3)})`;
    ctx.fillRect(0, 0, W, H);
    flashAmt = Math.max(0, flashAmt - dt * 7);
  }
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
    type: def.type || 'color',
    value: def.value || '#ff2266',
  };
  state.cues.push(cue);
  renderCueRow(cue);
}

function renderCueRow(cue) {
  const tr = document.createElement('tr');
  tr.dataset.id = cue.id;
  tr.innerHTML = `
    <td><input class="cue-time-input" type="text" value="${cue.timeStr}" spellcheck="false"></td>
    <td>
      <select class="cue-type">
        <option value="color">Color</option>
        <option value="formation">Formation</option>
        <option value="custom">Custom</option>
        <option value="text">Text</option>
        <option value="flash">Flash</option>
      </select>
    </td>
    <td class="val-cell"></td>
    <td><button class="del-btn" title="Delete">&#10005;</button></td>
  `;
  tr.querySelector('.cue-type').value = cue.type;

  const timeInput  = tr.querySelector('.cue-time-input');
  const typeSelect = tr.querySelector('.cue-type');
  const valCell    = tr.querySelector('.val-cell');

  function rebuildValueCell() {
    valCell.innerHTML = buildValueInput(cue);

    // Standard inputs (color picker, formation select, text)
    const inp = valCell.querySelector('.cue-val');
    if (inp && cue.type !== 'custom') {
      inp.addEventListener('change', () => { cue.value = inp.value; });
      inp.addEventListener('input',  () => { cue.value = inp.value; });
    }

    // Custom: "Edit positions" button
    const editBtn = valCell.querySelector('.btn-edit-pos');
    if (editBtn) {
      editBtn.addEventListener('click', () => enterEditMode(cue, rebuildValueCell));
    }
  }

  timeInput.addEventListener('blur', () => {
    const t = parseTime(timeInput.value);
    if (isNaN(t)) {
      timeInput.classList.add('error');
    } else {
      timeInput.classList.remove('error');
      cue.timeStr = timeInput.value;
      cue.timeSeconds = t;
      sortCues();
    }
  });

  typeSelect.addEventListener('change', () => {
    cue.type  = typeSelect.value;
    cue.value = defaultValue(cue.type);
    rebuildValueCell();
  });

  tr.querySelector('.del-btn').addEventListener('click', () => {
    state.cues = state.cues.filter(c => c.id !== cue.id);
    tr.remove();
  });

  rebuildValueCell();
  cueList.appendChild(tr);
}

function buildValueInput(cue) {
  switch (cue.type) {
    case 'color':
    case 'flash':
      return `<input class="cue-val" type="color" value="${cue.value}">`;
    case 'formation':
      return `<select class="cue-val">
        <option value="grid"    ${cue.value==='grid'    ?'selected':''}>Grid</option>
        <option value="circle"  ${cue.value==='circle'  ?'selected':''}>Circle</option>
        <option value="line"    ${cue.value==='line'    ?'selected':''}>H-Line</option>
        <option value="vline"   ${cue.value==='vline'   ?'selected':''}>V-Line</option>
        <option value="scatter" ${cue.value==='scatter' ?'selected':''}>Scatter</option>
      </select>`;
    case 'custom': {
      let saved = false;
      try { saved = Array.isArray(JSON.parse(cue.value)); } catch (_) {}
      return `<button class="btn-edit-pos${saved?' saved':''}">
        ${saved ? 'Edit positions ↗' : 'Set positions ↗'}
      </button>`;
    }
    case 'text':
      return `<input class="cue-val" type="text" value="${cue.value.replace(/"/g,'&quot;')}" placeholder="Label" maxlength="20">`;
    default:
      return '';
  }
}

function defaultValue(type) {
  return {
    color:     '#ff2266',
    formation: 'circle',
    custom:    JSON.stringify(FORMATIONS.grid.map(p => ({x:p.x, y:p.y}))),
    text:      'CUE',
    flash:     '#ffffff',
  }[type] || '';
}

function sortCues() {
  state.cues.sort((a,b) => a.timeSeconds - b.timeSeconds);
  state.cues.forEach(cue => {
    const row = cueList.querySelector(`[data-id="${cue.id}"]`);
    if (row) cueList.appendChild(row);
  });
}

// ── Event listeners ────────────────────────────────────────────────────────

addCueBtn.addEventListener('click', () => addCue());
playBtn.addEventListener('click', play);
stopBtn.addEventListener('click', stop);
editSaveBtn.addEventListener('click',   () => exitEditMode(true));
editCancelBtn.addEventListener('click', () => exitEditMode(false));

// ── Demo cues ──────────────────────────────────────────────────────────────

[
  { timeStr:'00:01.000', type:'color',     value:'#ff2266' },
  { timeStr:'00:02.000', type:'formation', value:'circle'  },
  { timeStr:'00:03.000', type:'color',     value:'#00e87a' },
  { timeStr:'00:04.000', type:'text',      value:'SYNC OK' },
  { timeStr:'00:05.000', type:'formation', value:'line'    },
  { timeStr:'00:06.000', type:'flash',     value:'#ffffff' },
  { timeStr:'00:07.000', type:'color',     value:'#7b4dff' },
  { timeStr:'00:08.000', type:'formation', value:'scatter' },
  { timeStr:'00:09.000', type:'formation', value:'grid'    },
].forEach(d => addCue({ ...d, timeSeconds: parseTime(d.timeStr) }));

// ── Start ──────────────────────────────────────────────────────────────────

requestAnimationFrame(animate);

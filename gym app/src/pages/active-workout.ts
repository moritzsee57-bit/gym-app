import { addWorkout, addExerciseLog, getLogsByExercise, type Split, type SetEntry, type ExerciseLog } from '../db';
import { epley1RM, bestSet } from '../utils/progression';
import { formatElapsed, fmtKg, todayISO, formatCountdown } from '../utils/formatters';
import { navigate, showToast } from '../app';

// ─── State ────────────────────────────────────────────────────────────────────
let activeSplit: Split | null = null;
let startTime = 0;
let timerInterval: number | null = null;
let elapsedMs = 0;

// Keyed by exerciseName → ExerciseLog (in-progress)
let logMap: Map<string, ExerciseLog> = new Map();
// Previous bests
let prevBestMap: Map<string, SetEntry | null> = new Map();

// Rest timer
let restSec = 0;
let restTarget = 180;
let restInterval: number | null = null;

export function setActiveSplit(split: Split) {
  activeSplit = split;
  logMap = new Map();
  prevBestMap = new Map();
  startTime = Date.now();
  elapsedMs = 0;
}

export async function renderActiveWorkout(container: HTMLElement) {
  if (!activeSplit) { navigate('workout'); return; }

  // Pre-load previous bests
  for (const ex of activeSplit.exercises) {
    if (!logMap.has(ex)) {
      logMap.set(ex, { workoutId: 0, exerciseName: ex, muscleGroup: '', sets: [] });
    }
    const prev = await getLogsByExercise(ex);
    prevBestMap.set(ex, prev.length > 0 ? bestSet(prev[prev.length - 1].sets) : null);
  }

  container.innerHTML = buildWorkoutHTML();
  startTimer();
  bindWorkoutEvents();
}

function buildWorkoutHTML(): string {
  const exercises = activeSplit!.exercises;
  return `
    <div class="page fade-in" id="page-active" style="padding-bottom:140px">
      <div class="bg-glow"></div>

      <!-- Header -->
      <div class="page-header" style="padding-bottom:10px">
        <div class="flex items-center justify-between">
          <div>
            <p class="section-sub">${activeSplit!.emoji} ${activeSplit!.name}</p>
            <h1 id="workout-timer" class="font-mono" style="font-size:2.4rem;color:var(--green);line-height:1">00:00</h1>
          </div>
          <button class="btn-ghost" style="padding:10px 16px;font-size:0.82rem;color:var(--red);border-color:rgba(255,61,87,0.3)" onclick="confirmEndWorkout()">
            <span class="material-symbols-outlined" style="font-size:18px">stop_circle</span>
            Beenden
          </button>
        </div>
      </div>

      <!-- Exercises -->
      <div style="padding:0 20px" id="exercises-container">
        ${exercises.map(ex => buildExerciseCard(ex)).join('')}
      </div>

      <!-- Add exercise -->
      <div style="padding:16px 20px 0">
        <button class="btn-ghost w-full" onclick="showAddExercise()">
          <span class="material-symbols-outlined">add_circle</span>
          Übung hinzufügen
        </button>
      </div>

      <!-- FAB rest timer -->
      <button class="fab" onclick="openRestTimer()" id="rest-fab" title="Pause-Timer" aria-label="Pause-Timer starten">
        <span class="material-symbols-outlined" style="font-size:26px">timer</span>
      </button>

      <!-- Rest Timer Overlay -->
      <div id="rest-overlay" class="overlay hidden">
        <div class="overlay-card scale-in" style="text-align:center">
          <p style="font-size:0.75rem;color:var(--text-sub);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:20px">Pause-Timer</p>
          <div class="timer-ring m-auto" id="rest-ring-wrapper">
            <svg width="200" height="200" viewBox="0 0 200 200">
              <circle cx="100" cy="100" r="86" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="8"/>
              <circle id="rest-arc" cx="100" cy="100" r="86" fill="none" stroke="#39ff14" stroke-width="8"
                stroke-linecap="round" stroke-dasharray="540" stroke-dashoffset="0"
                style="filter:drop-shadow(0 0 8px #39ff14);transition:stroke-dashoffset 1s linear"/>
            </svg>
            <span id="rest-display" class="time-display">03:00</span>
          </div>
          <div class="flex gap-2 justify-between" style="margin-top:24px">
            ${[180, 240, 300, 360].map(s => `
              <button class="tag-pill ${s === 180 ? 'active' : ''}" onclick="setRestPreset(${s})">${Math.floor(s/60)}m</button>
            `).join('')}
          </div>
          <button onclick="closeRestTimer()" style="margin-top:20px;font-size:0.85rem;color:var(--text-sub);font-weight:600">
            Überspringen
          </button>
        </div>
      </div>

      <!-- End workout overlay -->
      <div id="end-overlay" class="overlay hidden">
        <div class="overlay-card scale-in" style="text-align:center">
          <span class="material-symbols-outlined" style="font-size:3rem;color:var(--green)">emoji_events</span>
          <h2 style="font-family:var(--font-display);font-size:2rem;margin:10px 0">Workout abgeschlossen!</h2>
          <p style="color:var(--text-sub);font-size:0.9rem;margin-bottom:20px">Deine Daten wurden gespeichert.</p>
          <button class="btn-neon" onclick="finishWorkout()">
            <span class="material-symbols-outlined">check_circle</span>
            Abschluss & Speichern
          </button>
          <button onclick="closeEndOverlay()" style="margin-top:12px;width:100%;padding:12px;color:var(--text-sub);font-weight:600">
            Weiter trainieren
          </button>
        </div>
      </div>

      <!-- Add Exercise Overlay -->
      <div id="add-ex-overlay" class="overlay hidden">
        <div class="overlay-card scale-in">
          <h2 style="font-family:var(--font-display);font-size:1.8rem;margin-bottom:16px">Übung hinzufügen</h2>
          <input id="new-ex-name" class="form-input" placeholder="Übungsname" style="margin-bottom:12px"/>
          <div class="flex gap-2">
            <button class="btn-ghost flex-1" onclick="hideAddExercise()">Abbrechen</button>
            <button class="btn-neon flex-1" style="border-radius:var(--radius)" onclick="addExerciseDyn()">Hinzufügen</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function buildExerciseCard(ex: string): string {
  const log = logMap.get(ex)!;
  const prev = prevBestMap.get(ex);
  const prevText = prev ? `${prev.weight}kg × ${prev.reps}` : '–';
  const setsCount = Math.max(3, log.sets.length);

  let setRows = '';
  for (let i = 0; i < setsCount; i++) {
    const set = log.sets[i];
    const done = set?.completed;
    setRows += `
      <div class="set-row" data-exercise="${encodeURIComponent(ex)}" data-set="${i}">
        <span class="set-num">${i + 1}</span>
        <input type="number" min="0" max="999" step="0.5" placeholder="kg"
          class="${done ? 'completed' : ''}" value="${set?.weight ?? ''}"
          oninput="updateSet('${encodeURIComponent(ex)}',${i},'weight',this.value)"/>
        <input type="number" min="0" max="99" step="1" placeholder="Wdh"
          class="${done ? 'completed' : ''}" value="${set?.reps ?? ''}"
          oninput="updateSet('${encodeURIComponent(ex)}',${i},'reps',this.value)"/>
        <button class="set-check ${done ? 'done' : ''}" onclick="toggleSet('${encodeURIComponent(ex)}',${i})">
          <span class="material-symbols-outlined" style="font-size:18px">${done ? 'check' : 'circle'}</span>
        </button>
      </div>
    `;
  }

  return `
    <div class="exercise-card" id="ex-card-${encodeURIComponent(ex)}">
      <div class="ex-header">
        <span class="ex-name">${ex}</span>
        <span class="last-best" id="best-label-${encodeURIComponent(ex)}">Letztes Mal: ${prevText}</span>
      </div>
      <div class="set-row" style="border-bottom:1px solid var(--border);padding-bottom:6px;margin-bottom:4px">
        <span class="set-num">#</span>
        <span style="text-align:center;font-size:0.7rem;color:var(--text-sub);font-weight:600">kg</span>
        <span style="text-align:center;font-size:0.7rem;color:var(--text-sub);font-weight:600">Wdh</span>
        <span></span>
      </div>
      <div id="sets-${encodeURIComponent(ex)}">
        ${setRows}
      </div>
      <button class="btn-ghost w-full" style="margin-top:10px;padding:8px;font-size:0.82rem"
        onclick="addSetRow('${encodeURIComponent(ex)}')">
        <span class="material-symbols-outlined" style="font-size:16px">add</span>
        Satz hinzufügen
      </button>
    </div>
  `;
}

function startTimer() {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = window.setInterval(() => {
    elapsedMs = Date.now() - startTime;
    const el = document.getElementById('workout-timer');
    if (el) el.textContent = formatElapsed(elapsedMs);
  }, 1000);
}

function bindWorkoutEvents() {
  (window as any).updateSet = (exEnc: string, setIdx: number, field: 'weight' | 'reps', val: string) => {
    const ex = decodeURIComponent(exEnc);
    const log = logMap.get(ex)!;
    if (!log.sets[setIdx]) log.sets[setIdx] = { setNumber: setIdx + 1, weight: 0, reps: 0, completed: false };
    log.sets[setIdx][field] = parseFloat(val) || 0;
    updateComparisonLabel(ex);
  };

  (window as any).toggleSet = (exEnc: string, setIdx: number) => {
    const ex = decodeURIComponent(exEnc);
    const log = logMap.get(ex)!;
    if (!log.sets[setIdx]) log.sets[setIdx] = { setNumber: setIdx + 1, weight: 0, reps: 0, completed: false };
    const done = !log.sets[setIdx].completed;
    log.sets[setIdx].completed = done;

    // Update UI for that row
    const card = document.getElementById(`ex-card-${exEnc}`);
    if (!card) return;
    const row = card.querySelectorAll('.set-row')[setIdx + 1]; // +1 for header row
    if (!row) return;
    const inputs = row.querySelectorAll('input');
    inputs.forEach(inp => { if (done) inp.classList.add('completed'); else inp.classList.remove('completed'); });
    const btn = row.querySelector('.set-check')!;
    btn.classList.toggle('done', done);
    btn.querySelector('.material-symbols-outlined')!.textContent = done ? 'check' : 'circle';

    // If done, auto-open rest timer
    if (done) (window as any).openRestTimer();

    updateComparisonLabel(ex);
  };

  (window as any).addSetRow = (exEnc: string) => {
    const ex = decodeURIComponent(exEnc);
    const log = logMap.get(ex)!;
    const newIdx = log.sets.length;
    log.sets.push({ setNumber: newIdx + 1, weight: 0, reps: 0, completed: false });
    const setsContainer = document.getElementById(`sets-${exEnc}`)!;
    const div = document.createElement('div');
    div.innerHTML = `
      <div class="set-row" data-exercise="${exEnc}" data-set="${newIdx}">
        <span class="set-num">${newIdx + 1}</span>
        <input type="number" min="0" max="999" step="0.5" placeholder="kg"
          oninput="updateSet('${exEnc}',${newIdx},'weight',this.value)"/>
        <input type="number" min="0" max="99" step="1" placeholder="Wdh"
          oninput="updateSet('${exEnc}',${newIdx},'reps',this.value)"/>
        <button class="set-check" onclick="toggleSet('${exEnc}',${newIdx})">
          <span class="material-symbols-outlined" style="font-size:18px">circle</span>
        </button>
      </div>
    `;
    setsContainer.appendChild(div.firstElementChild!);
  };

  // Rest timer
  (window as any).openRestTimer = () => {
    restTarget = restTarget || 90;
    restSec = restTarget;
    document.getElementById('rest-overlay')!.classList.remove('hidden');
    startRestCountdown();
  };

  (window as any).closeRestTimer = () => {
    clearRestInterval();
    document.getElementById('rest-overlay')!.classList.add('hidden');
  };

  (window as any).setRestPreset = (s: number) => {
    restTarget = s;
    restSec = s;
    document.querySelectorAll('.tag-pill').forEach(p => p.classList.remove('active'));
    event?.target && (event!.target as HTMLElement).classList.add('active');
    clearRestInterval();
    updateRestDisplay();
    startRestCountdown();
  };

  (window as any).confirmEndWorkout = () => {
    document.getElementById('end-overlay')!.classList.remove('hidden');
  };

  (window as any).closeEndOverlay = () => {
    document.getElementById('end-overlay')!.classList.add('hidden');
  };

  (window as any).finishWorkout = async () => {
    clearTimers();
    const workoutId = await addWorkout({
      splitName: activeSplit!.name,
      date: todayISO(),
      durationMs: elapsedMs,
    });
    for (const [, log] of logMap.entries()) {
      const doneSets = log.sets.filter(s => s.completed && (s.weight > 0 || s.reps > 0));
      if (doneSets.length > 0) {
        await addExerciseLog({ ...log, workoutId, sets: doneSets });
      }
    }
    activeSplit = null;
    logMap.clear();
    navigate('dashboard');
    showToast('Workout gespeichert! 🎉');
  };

  (window as any).showAddExercise = () => {
    document.getElementById('add-ex-overlay')!.classList.remove('hidden');
  };

  (window as any).hideAddExercise = () => {
    document.getElementById('add-ex-overlay')!.classList.add('hidden');
  };

  (window as any).addExerciseDyn = () => {
    const name = (document.getElementById('new-ex-name') as HTMLInputElement).value.trim();
    if (!name) return;
    if (!activeSplit) return;
    activeSplit.exercises.push(name);
    logMap.set(name, { workoutId: 0, exerciseName: name, muscleGroup: '', sets: [] });
    prevBestMap.set(name, null);
    const cont = document.getElementById('exercises-container')!;
    const div = document.createElement('div');
    div.innerHTML = buildExerciseCard(name);
    cont.appendChild(div.firstElementChild!);
    (window as any).hideAddExercise();
  };

  (window as any).navigate = navigate;
}

function updateComparisonLabel(ex: string) {
  const exEnc = encodeURIComponent(ex);
  const log = logMap.get(ex)!;
  const prev = prevBestMap.get(ex);
  if (!prev) return;
  const cur = bestSet(log.sets);
  const label = document.getElementById(`best-label-${exEnc}`) as HTMLElement;
  if (!label) return;
  if (!cur) { label.className = 'last-best'; return; }
  const curRM = epley1RM(cur.weight, cur.reps);
  const prevRM = epley1RM(prev.weight, prev.reps);
  if (curRM > prevRM) {
    label.className = 'last-best better';
    label.textContent = `↑ ${fmtKg(cur.weight)} × ${cur.reps} (war ${fmtKg(prev.weight)} × ${prev.reps})`;
  } else if (curRM < prevRM) {
    label.className = 'last-best worse';
    label.textContent = `↓ ${fmtKg(cur.weight)} × ${cur.reps} (war ${fmtKg(prev.weight)} × ${prev.reps})`;
  } else {
    label.className = 'last-best';
    label.textContent = `= ${fmtKg(cur.weight)} × ${cur.reps}`;
  }
}

function startRestCountdown() {
  clearRestInterval();
  updateRestDisplay();
  restInterval = window.setInterval(() => {
    restSec--;
    if (restSec <= 0) {
      restSec = 0;
      clearRestInterval();
      // vibrate if supported
      if ('vibrate' in navigator) navigator.vibrate([200, 100, 200]);
    }
    updateRestDisplay();
  }, 1000);
}

function updateRestDisplay() {
  const display = document.getElementById('rest-display');
  const arc = document.getElementById('rest-arc');
  if (display) display.textContent = formatCountdown(restSec);
  if (arc) {
    const pct = restSec / restTarget;
    const circumference = 2 * Math.PI * 86; // ~540
    arc.setAttribute('stroke-dashoffset', String(circumference * (1 - pct)));
  }
}

function clearRestInterval() {
  if (restInterval) { clearInterval(restInterval); restInterval = null; }
}

function clearTimers() {
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
  clearRestInterval();
}

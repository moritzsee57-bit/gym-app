import { getProfile, updateProfile, getAllWorkouts, getAllExerciseLogs, getAllBodyWeights, addBodyWeight, deleteBodyWeight, clearAllData, exportData, importData } from '../db';
import { bestVolume, getBodyWeightTrend } from '../utils/progression';
import { fmtVolume, formatShortDate } from '../utils/formatters';
import { showToast } from '../app';

export async function renderProfile(container: HTMLElement) {
    const [profile, workouts, logs, bodyWeights] = await Promise.all([getProfile(), getAllWorkouts(), getAllExerciseLogs(), getAllBodyWeights()]);
    const totalVol = logs.reduce((t, l) => t + bestVolume(l.sets), 0);
    const since = profile.createdAt ? formatShortDate(profile.createdAt) : '–';
    
    const currentWeight = bodyWeights.length > 0 ? bodyWeights[0].weight : null;
    const trend = getBodyWeightTrend(bodyWeights);

    container.innerHTML = `
    <div class="page fade-in" id="page-profile">
      <div class="bg-glow"></div>
      <div class="page-header">
        <h1 class="section-title" style="font-size:2.2rem">Profil</h1>
      </div>

      <div style="padding:0 20px">
        <!-- Avatar & Name -->
        <div class="glass" style="padding:20px;border-radius:var(--radius-lg);margin-bottom:16px;text-align:center">
          <div class="avatar m-auto" style="margin-bottom:12px">💪</div>
          <div id="name-display">
            <p style="font-size:1.4rem;font-weight:700" id="name-text">${profile.name}</p>
            <button onclick="editName()" style="font-size:0.8rem;color:var(--green);font-weight:600;margin-top:4px">
              <span class="material-symbols-outlined" style="font-size:14px;vertical-align:middle">edit</span>
              Bearbeiten
            </button>
          </div>
          <div id="name-edit" class="hidden" style="margin-top:8px">
            <input id="name-input" class="form-input" value="${profile.name}" style="text-align:center;margin-bottom:8px"/>
            <div class="flex gap-2">
              <button class="btn-ghost flex-1" onclick="cancelEditName()">Abbrechen</button>
              <button class="btn-neon flex-1" style="border-radius:var(--radius)" onclick="saveName()">Speichern</button>
            </div>
          </div>
        </div>

        <!-- Stats Summary -->
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:16px">
          <div class="glass" style="padding:14px;border-radius:var(--radius);text-align:center">
            <p style="font-size:1.4rem;font-family:var(--font-mono);color:var(--green);font-weight:600">${workouts.length}</p>
            <p style="font-size:0.62rem;color:var(--text-sub);text-transform:uppercase;letter-spacing:0.06em">Workouts</p>
          </div>
          <div class="glass" style="padding:14px;border-radius:var(--radius);text-align:center">
            <p style="font-size:1.4rem;font-family:var(--font-mono);color:var(--green);font-weight:600">${fmtVolume(totalVol)}</p>
            <p style="font-size:0.62rem;color:var(--text-sub);text-transform:uppercase;letter-spacing:0.06em">Volumen</p>
          </div>
          <div class="glass" style="padding:14px;border-radius:var(--radius);text-align:center">
            <p style="font-size:1rem;font-family:var(--font-mono);color:var(--green);font-weight:600">${since}</p>
            <p style="font-size:0.62rem;color:var(--text-sub);text-transform:uppercase;letter-spacing:0.06em">Dabei seit</p>
          </div>
        </div>

        <!-- Settings -->
        <div class="glass" style="border-radius:var(--radius-lg);overflow:hidden;margin-bottom:16px">
          <p style="padding:14px 18px 6px;font-size:0.7rem;color:var(--text-sub);font-weight:700;text-transform:uppercase;letter-spacing:0.1em">Einstellungen</p>

          <!-- Rest timer default -->
          <div class="flex items-center justify-between" style="padding:14px 18px;border-bottom:1px solid var(--border)">
            <div>
              <p style="font-weight:600;font-size:0.9rem">Standard Pause</p>
              <p style="font-size:0.75rem;color:var(--text-sub)">${profile.defaultRestSec}s</p>
            </div>
            <div class="flex gap-2">
              ${[180, 240, 300, 360].map(s => `
                <button class="tag-pill ${s === profile.defaultRestSec ? 'active' : ''}" onclick="setDefaultRest(${s}, this)">${Math.floor(s/60)}m</button>
              `).join('')}
            </div>
          </div>

          <!-- Export -->
          <div class="flex items-center justify-between" style="padding:14px 18px;border-bottom:1px solid var(--border);cursor:pointer" onclick="exportAllData()">
            <div class="flex items-center gap-3">
              <span class="material-symbols-outlined" style="color:var(--green)">download</span>
              <div>
                <p style="font-weight:600;font-size:0.9rem">Daten exportieren</p>
                <p style="font-size:0.75rem;color:var(--text-sub)">JSON-Datei herunterladen</p>
              </div>
            </div>
            <span class="material-symbols-outlined text-sub" style="font-size:18px">chevron_right</span>
          </div>

          <!-- Import -->
          <div class="flex items-center justify-between" style="padding:14px 18px;cursor:pointer" onclick="document.getElementById('import-input').click()">
            <div class="flex items-center gap-3">
              <span class="material-symbols-outlined" style="color:var(--green)">upload</span>
              <div>
                <p style="font-weight:600;font-size:0.9rem">Daten importieren</p>
                <p style="font-size:0.75rem;color:var(--text-sub)">JSON-Datei einlesen</p>
              </div>
            </div>
            <span class="material-symbols-outlined text-sub" style="font-size:18px">chevron_right</span>
          </div>
          <input id="import-input" type="file" accept=".json" class="hidden" onchange="importAllData(this)"/>
        </div>

        <!-- Body Weight Tracking -->
        <div class="glass" style="border-radius:var(--radius-lg);overflow:hidden;margin-bottom:16px">
          <p style="padding:14px 18px 6px;font-size:0.7rem;color:var(--text-sub);font-weight:700;text-transform:uppercase;letter-spacing:0.1em">Körpergewicht</p>

          <!-- Current Weight -->
          <div style="padding:14px 18px;border-bottom:1px solid var(--border)">
            <div class="flex items-center justify-between" style="margin-bottom:8px">
              <div>
                <p style="font-weight:600;font-size:0.9rem">Aktuelles Gewicht</p>
                <p style="font-size:0.75rem;color:var(--text-sub)">${bodyWeights.length} Einträge</p>
              </div>
              ${currentWeight ? `
                <div style="text-align:right">
                  <p style="font-size:1.6rem;font-family:var(--font-mono);color:var(--green);font-weight:600">${currentWeight.toFixed(1)}</p>
                  <p style="font-size:0.65rem;color:var(--text-sub)">kg</p>
                </div>
              ` : `
                <p style="font-size:0.85rem;color:var(--text-sub)">Noch keine Einträge</p>
              `}
            </div>
            <button class="btn-ghost w-full" style="padding:8px;font-size:0.85rem" onclick="openAddBodyWeight()">
              <span class="material-symbols-outlined" style="font-size:16px">add</span>
              Gewicht hinzufügen
            </button>
          </div>

          <!-- Trend -->
          ${bodyWeights.length > 0 ? `
          <div style="padding:14px 18px;border-bottom:1px solid var(--border)">
            <p style="font-weight:600;font-size:0.9rem;margin-bottom:6px">Trend</p>
            <div class="flex items-center gap-2">
              <span class="material-symbols-outlined" style="font-size:18px;color:${trend > 0 ? 'var(--red)' : 'var(--green)'}">${trend > 0 ? 'trending_up' : 'trending_down'}</span>
              <p style="font-size:1rem;font-family:var(--font-mono);color:${trend > 0 ? 'var(--red)' : 'var(--green)'};font-weight:600">
                ${trend > 0 ? '+' : ''}${trend.toFixed(1)}%
              </p>
              <p style="font-size:0.75rem;color:var(--text-sub);">von erstem zu letztem Eintrag</p>
            </div>
          </div>
          ` : ''}

          <!-- Recent entries -->
          ${bodyWeights.length > 0 ? `
          <div style="padding:14px 18px;">
            <p style="font-weight:600;font-size:0.9rem;margin-bottom:8px">Letzte Einträge</p>
            <div style="display:flex;flex-direction:column;gap:6px;max-height:200px;overflow-y:auto">
              ${bodyWeights.slice(0, 5).map((bw) => `
                <div class="flex items-center justify-between" style="padding:8px;background:var(--card2);border-radius:var(--radius-sm);">
                  <div>
                    <p style="font-family:var(--font-mono);font-size:0.9rem;font-weight:600">${bw.weight.toFixed(1)} kg</p>
                    <p style="font-size:0.65rem;color:var(--text-sub)">${formatShortDate(bw.date)}</p>
                  </div>
                  <button style="padding:4px 8px;color:var(--red);font-size:0.7rem;font-weight:600" onclick="deleteBodyWeightEntry(${bw.id})">
                    <span class="material-symbols-outlined" style="font-size:14px">delete</span>
                  </button>
                </div>
              `).join('')}
            </div>
          </div>
          ` : ''}
        </div>
        <div style="margin-bottom:24px">
          <button class="btn-danger" onclick="confirmClear()">
            <span class="material-symbols-outlined">delete_forever</span>
            Alle Daten löschen
          </button>
        </div>

        <p style="text-align:center;font-size:0.7rem;color:var(--text-dim);padding-bottom:12px">
          Alle Daten werden nur lokal auf deinem Gerät gespeichert.
        </p>
      </div>

      <!-- Confirm Delete Overlay -->
      <div id="confirm-clear-overlay" class="overlay hidden">
        <div class="overlay-card scale-in" style="text-align:center">
          <span class="material-symbols-outlined" style="font-size:3rem;color:var(--red)">warning</span>
          <h2 style="font-family:var(--font-display);font-size:1.8rem;margin:10px 0;color:var(--red)">Achtung!</h2>
          <p style="color:var(--text-sub);font-size:0.9rem;margin-bottom:20px;line-height:1.5">
            Alle Workouts, Übungen und Fortschritte werden unwiderruflich gelöscht.
          </p>
          <button class="btn-danger" style="margin-bottom:10px" onclick="doDeleteAll()">
            Ja, alles löschen
          </button>
          <button onclick="document.getElementById('confirm-clear-overlay').classList.add('hidden')"
            style="width:100%;padding:12px;color:var(--text-sub);font-weight:600">
            Abbrechen
          </button>
        </div>
      </div>

      <!-- Add Body Weight Overlay -->
      <div id="add-bw-overlay" class="overlay hidden">
        <div class="overlay-card scale-in">
          <h2 style="font-family:var(--font-display);font-size:1.8rem;margin-bottom:16px">Körpergewicht</h2>
          <div style="margin-bottom:12px">
            <p class="form-label">Gewicht (kg)</p>
            <input id="bw-input" class="form-input" type="number" min="0" max="300" step="0.1" placeholder="z.B. 75.5" style="font-size:1.2rem;text-align:center"/>
          </div>
          <div style="margin-bottom:20px">
            <p class="form-label">Notizen (optional)</p>
            <textarea id="bw-notes" class="form-input" placeholder="z.B. Nach Workout"></textarea>
          </div>
          <div class="flex gap-2">
            <button class="btn-ghost flex-1" onclick="closeAddBodyWeight()">Abbrechen</button>
            <button class="btn-neon flex-1" style="border-radius:var(--radius)" onclick="saveBodyWeight()">Speichern</button>
          </div>
        </div>
      </div>
    </div>
  `;

    // Bind all events
    (window as any).editName = () => {
        document.getElementById('name-display')!.classList.add('hidden');
        document.getElementById('name-edit')!.classList.remove('hidden');
    };

    (window as any).cancelEditName = () => {
        document.getElementById('name-display')!.classList.remove('hidden');
        document.getElementById('name-edit')!.classList.add('hidden');
    };

    (window as any).saveName = async () => {
        const val = (document.getElementById('name-input') as HTMLInputElement).value.trim();
        if (!val) return;
        const p = await getProfile();
        await updateProfile({ ...p, name: val });
        document.getElementById('name-text')!.textContent = val;
        (window as any).cancelEditName();
        showToast('Name gespeichert!');
    };

    (window as any).setDefaultRest = async (sec: number, btn: HTMLElement) => {
        const p = await getProfile();
        await updateProfile({ ...p, defaultRestSec: sec });
        document.querySelectorAll('#page-profile .tag-pill').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        showToast(`Standard-Pause: ${sec}s`);
    };

    (window as any).exportAllData = async () => {
        const json = await exportData();
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `gym-tracker-export-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('Export erstellt!');
    };

    (window as any).importAllData = async (input: HTMLInputElement) => {
        const file = input.files?.[0];
        if (!file) return;
        const text = await file.text();
        try {
            await importData(text);
            showToast('Import erfolgreich!');
            await renderProfile(container);
        } catch {
            showToast('Import fehlgeschlagen – ungültige Datei.');
        }
    };

    (window as any).confirmClear = () => {
        document.getElementById('confirm-clear-overlay')!.classList.remove('hidden');
    };

    (window as any).doDeleteAll = async () => {
        await clearAllData();
        document.getElementById('confirm-clear-overlay')!.classList.add('hidden');
        await renderProfile(container);
        showToast('Alle Daten gelöscht.');
    };

    // Body Weight functions
    (window as any).openAddBodyWeight = () => {
        (document.getElementById('bw-input') as HTMLInputElement).value = '';
        (document.getElementById('bw-notes') as HTMLTextAreaElement).value = '';
        document.getElementById('add-bw-overlay')!.classList.remove('hidden');
        setTimeout(() => {
            (document.getElementById('bw-input') as HTMLInputElement).focus();
        }, 100);
    };

    (window as any).closeAddBodyWeight = () => {
        document.getElementById('add-bw-overlay')!.classList.add('hidden');
    };

    (window as any).saveBodyWeight = async () => {
        const weight = parseFloat((document.getElementById('bw-input') as HTMLInputElement).value);
        const notes = (document.getElementById('bw-notes') as HTMLTextAreaElement).value.trim();
        
        if (!weight || weight <= 0) {
            showToast('Bitte gib ein gültiges Gewicht ein');
            return;
        }

        await addBodyWeight(weight, notes || undefined);
        (window as any).closeAddBodyWeight();
        await renderProfile(container);
        showToast('Körpergewicht gespeichert!');
    };

    (window as any).deleteBodyWeightEntry = async (id: number) => {
        await deleteBodyWeight(id);
        await renderProfile(container);
        showToast('Eintrag gelöscht');
    };
}

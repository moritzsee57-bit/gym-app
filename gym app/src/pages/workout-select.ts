import { getAllSplits, getAllWorkouts, addSplit, type Split } from '../db';
import { formatShortDate } from '../utils/formatters';
import { navigate, showToast, setActiveWorkoutSplit } from '../app';

export async function renderWorkoutSelect(container: HTMLElement) {
  const [splits, workouts] = await Promise.all([getAllSplits(), getAllWorkouts()]);

  // Last trained per split
  const lastMap = new Map<string, string>();
  for (const w of workouts) {
    if (!lastMap.has(w.splitName)) lastMap.set(w.splitName, w.date);
  }

  container.innerHTML = `
    <div class="page fade-in" id="page-workout">
      <div class="bg-glow"></div>
      <div class="page-header">
        <h1 class="section-title" style="font-size:2.2rem">Workout starten</h1>
        <p class="section-sub">Wähle deinen Split</p>
      </div>

      <div style="padding:8px 20px">
        <div style="display:flex;flex-direction:column;gap:10px" id="split-list">
          ${splits.map(s => {
    const last = lastMap.get(s.name);
    const exercises = s.exercises.length;
    return `
              <div class="split-card" data-split-id="${s.id}" onclick="startSplit(${s.id})">
                <div class="flex items-center gap-4">
                  <span class="split-emoji">${s.emoji}</span>
                  <div>
                    <p class="split-name">${s.name}</p>
                    <p class="split-meta">${exercises} Übungen · ~${Math.round(exercises * 8)}min</p>
                    <p class="split-meta">Zuletzt: ${last ? formatShortDate(last) : 'Noch nie'}</p>
                  </div>
                </div>
                <span class="material-symbols-outlined arrow" style="font-size:20px">arrow_forward_ios</span>
              </div>
            `;
  }).join('')}
        </div>

        <div style="margin-top:20px">
          <button class="btn-ghost w-full" onclick="showNewSplitForm()">
            <span class="material-symbols-outlined">add_circle</span>
            Neuen Split erstellen
          </button>
        </div>
      </div>

      <!-- New Split Form (hidden) -->
      <div id="new-split-overlay" class="overlay hidden">
        <div class="overlay-card scale-in">
          <h2 style="font-family:var(--font-display);font-size:1.8rem;margin-bottom:16px">Neuer Split</h2>
          <div style="margin-bottom:12px">
            <p class="form-label">Name</p>
            <input id="new-split-name" class="form-input" placeholder="z.B. Chest & Triceps" maxlength="30"/>
          </div>
          <div style="margin-bottom:12px">
            <p class="form-label">Emoji</p>
            <input id="new-split-emoji" class="form-input" placeholder="💪" maxlength="2" style="font-size:1.5rem;text-align:center"/>
          </div>
          <div style="margin-bottom:20px">
            <p class="form-label">Übungen (eine pro Zeile)</p>
            <textarea id="new-split-exercises" class="form-input" rows="5"
              placeholder="Bankdrücken&#10;Schulterdrücken&#10;Trizepsdrücken"
              style="resize:none"></textarea>
          </div>
          <div class="flex gap-2">
            <button class="btn-ghost flex-1" onclick="closeNewSplitForm()">Abbrechen</button>
            <button class="btn-neon flex-1" style="border-radius:var(--radius)" onclick="saveNewSplit()">Speichern</button>
          </div>
        </div>
      </div>
    </div>
  `;

  (window as any).startSplit = async (splitId: number) => {
    const splits = await getAllSplits();
    const split = splits.find(s => s.id === splitId);
    if (split) {
      setActiveWorkoutSplit(split);
      navigate('active-workout');
    }
  };

  (window as any).showNewSplitForm = () => {
    document.getElementById('new-split-overlay')!.classList.remove('hidden');
  };

  (window as any).closeNewSplitForm = () => {
    document.getElementById('new-split-overlay')!.classList.add('hidden');
  };

  (window as any).saveNewSplit = async () => {
    const name = (document.getElementById('new-split-name') as HTMLInputElement).value.trim();
    const emoji = (document.getElementById('new-split-emoji') as HTMLInputElement).value.trim() || '🏋️';
    const exerciseText = (document.getElementById('new-split-exercises') as HTMLTextAreaElement).value;
    const exercises = exerciseText.split('\n').map(e => e.trim()).filter(Boolean);

    if (!name || exercises.length === 0) {
      showToast('Name und mindestens eine Übung erforderlich!');
      return;
    }

    const newSplit: Omit<Split, 'id'> = { name, emoji, exercises, muscleGroups: [] };
    await addSplit(newSplit);
    (window as any).closeNewSplitForm();
    await renderWorkoutSelect(container);
    showToast('Split gespeichert! 💪');
  };

  (window as any).navigate = navigate;
}

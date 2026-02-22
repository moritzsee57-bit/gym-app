import { getAllWorkouts, getAllExerciseLogs, getProfile } from '../db';
import { buildRanking, groupByExercise, calcStreak, bestVolume } from '../utils/progression';
import { greeting, formatShortDate, fmtPercent, fmtVolume, formatDuration } from '../utils/formatters';
import { navigate } from '../app';

export async function renderDashboard(container: HTMLElement) {
    const [workouts, logs, profile] = await Promise.all([
        getAllWorkouts(),
        getAllExerciseLogs(),
        getProfile(),
    ]);

    const streak = calcStreak(workouts.map(w => w.date));
    const now = Date.now();
    const oneWeekMs = 7 * 86400000;
    const weekWorkouts = workouts.filter(w => now - new Date(w.date).getTime() < oneWeekMs);
    const weekLogs = logs.filter(l => weekWorkouts.some(w => w.id === l.workoutId));
    const totalVol = weekLogs.reduce((t, l) => t + bestVolume(l.sets), 0);

    const logMap = groupByExercise(logs);
    const ranking = buildRanking(logMap);
    const topGain = ranking.length > 0 ? ranking[0].changePercent : 0;
    const top3 = ranking.slice(0, 5);

    const today = new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });

    container.innerHTML = `
    <div class="page fade-in" id="page-dashboard">
      <div class="bg-glow"></div>
      <header class="page-header">
        <div class="flex items-center justify-between">
          <div>
            <p class="section-sub">${today}</p>
            <h1 class="section-title" style="font-size:2rem">${greeting()}, ${profile.name}</h1>
          </div>
          <div class="streak-badge">
            <span class="material-symbols-outlined" style="font-size:18px;font-variation-settings:'FILL' 1">local_fire_department</span>
            ${streak} Tage
          </div>
        </div>
      </header>

      <section style="padding:0 20px 4px">
        <p class="section-sub" style="margin-bottom:10px">Diese Woche</p>
        <div style="display:flex;gap:10px;overflow-x:auto;padding-bottom:8px">
          <div class="stat-card glass">
            <span class="label">Workouts</span>
            <span class="value">${weekWorkouts.length}</span>
            <span class="delta flex items-center gap-1">
              <span class="material-symbols-outlined" style="font-size:12px">fitness_center</span>
              diese Woche
            </span>
          </div>
          <div class="stat-card glass">
            <span class="label">Volumen</span>
            <span class="value">${fmtVolume(totalVol)}</span>
            <span class="delta flex items-center gap-1">
              <span class="material-symbols-outlined" style="font-size:12px">monitoring</span>
              bewegt
            </span>
          </div>
          <div class="stat-card glass">
            <span class="label">Top-Gain</span>
            <span class="value" style="font-size:1.5rem;${topGain >= 0 ? 'color:var(--green)' : 'color:var(--red)'}">${fmtPercent(topGain)}</span>
            <span class="delta">Stärkste Übung</span>
          </div>
        </div>
      </section>

      <section style="padding:16px 20px">
        <div class="flex items-center justify-between" style="margin-bottom:12px">
          <h2 style="font-weight:700;font-size:1rem">🏆 Top Steigerungen</h2>
          <button class="tag-pill active" onclick="navigate('statistics')">Alle ansehen</button>
        </div>
        ${top3.length === 0 ? `
          <div class="empty-state glass" style="padding:32px">
            <span class="material-symbols-outlined icon">bar_chart</span>
            <p>Noch keine Daten – starte dein erstes Workout!</p>
          </div>
        ` : `
          <div style="display:flex;flex-direction:column;gap:8px">
            ${top3.map((p, i) => {
        const pct = p.changePercent;
        const isPos = pct >= 0;
        const rankClass = i === 0 ? 'rank-1' : i === 1 ? 'rank-2' : i === 2 ? 'rank-3' : 'rank-n';
        const arrow = isPos ? 'north_east' : 'south_east';
        const cb = p.currentBest;
        const pb = p.previousBest;
        return `
                <div class="glass" style="padding:14px 16px;border-radius:var(--radius)">
                  <div class="flex items-center gap-3">
                    <div class="rank-badge ${rankClass}">${i + 1}</div>
                    <div style="flex:1;min-width:0">
                      <div class="flex items-center justify-between">
                        <span style="font-weight:700;font-size:0.9rem">${p.name}</span>
                        <span style="font-weight:800;font-size:0.9rem;color:${isPos ? 'var(--green)' : 'var(--red)'}">
                          <span class="material-symbols-outlined" style="font-size:13px;vertical-align:middle">${arrow}</span>
                          ${fmtPercent(pct)}
                        </span>
                      </div>
                      <div class="prog-bar" style="margin-top:6px">
                        <div class="prog-bar__fill" style="width:${Math.min(100, Math.abs(pct) * 4)}%;background:${isPos ? 'var(--green)' : 'var(--red)'}"></div>
                      </div>
                      ${cb && pb ? `<p style="font-size:0.68rem;color:var(--text-sub);margin-top:4px;font-family:var(--font-mono)">${pb.weight}kg → ${cb.weight}kg</p>` : ''}
                    </div>
                  </div>
                </div>
              `;
    }).join('')}
          </div>
        `}
      </section>

      ${workouts.length > 0 ? `
      <section style="padding:0 20px 16px">
        <h2 style="font-weight:700;font-size:1rem;margin-bottom:10px">📅 Letzte Workouts</h2>
        <div style="display:flex;flex-direction:column;gap:8px">
          ${workouts.slice(0, 3).map(w => `
            <div class="glass flex items-center justify-between" style="padding:14px 16px;border-radius:var(--radius)">
              <div>
                <p style="font-weight:600;font-size:0.9rem">${w.splitName}</p>
                <p style="font-size:0.72rem;color:var(--text-sub)">${formatShortDate(w.date)} · ${formatDuration(w.durationMs)}</p>
              </div>
              <span class="material-symbols-outlined text-sub">chevron_right</span>
            </div>
          `).join('')}
        </div>
      </section>
      ` : ''}

      <div style="padding:8px 20px 8px">
        <button class="btn-neon" onclick="navigate('workout')">
          <span class="material-symbols-outlined">play_circle</span>
          Workout starten
        </button>
      </div>
    </div>
  `;

    // expose navigate globally for inline onclick
    (window as any).navigate = navigate;
}

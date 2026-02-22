import { getAllExerciseLogs, getAllWorkouts, type ExerciseLog, type Workout } from '../db';
import { buildRanking, groupByExercise, bestVolume } from '../utils/progression';
import { fmtKg, formatShortDate } from '../utils/formatters';
import { Chart, LineController, LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Filler } from 'chart.js';

Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Filler);

type TimeRange = '1W' | '1M' | '3M' | '6M' | 'All';
let selectedRange: TimeRange = '1M';
let activeChart: Chart | null = null;
let selectedExercise: string | null = null;
let chartMode: 'weight' | 'volume' | '1rm' = 'weight';

const RANGE_MS: Record<TimeRange, number> = {
  '1W': 7 * 86400000,
  '1M': 30 * 86400000,
  '3M': 90 * 86400000,
  '6M': 180 * 86400000,
  'All': Infinity,
};

export async function renderStatistics(container: HTMLElement) {
  const [allLogs, workoutsAll] = await Promise.all([getAllExerciseLogs(), getAllWorkouts()]);
  const wMap = new Map(workoutsAll.map(w => [w.id!, w]));
  const allWorkouts = workoutsAll;

  // Filter by time range
  const cutoff = Date.now() - RANGE_MS[selectedRange];
  const filteredLogs = allLogs.filter(l => {
    const w = wMap.get(l.workoutId);
    return w ? new Date(w.date).getTime() >= cutoff : false;
  });

  const filtered = groupByExercise(filteredLogs);
  const ranking = buildRanking(filtered);

  if (!selectedExercise && ranking.length > 0) selectedExercise = ranking[0].name;

  container.innerHTML = `
    <div class="page fade-in" id="page-stats">
      <div class="bg-glow"></div>
      <div class="page-header">
        <h1 class="section-title" style="font-size:2.2rem">Deine Fortschritte</h1>
        <!-- Time range filter -->
        <div class="flex gap-2" style="margin-top:10px;flex-wrap:wrap">
          ${(['1W', '1M', '3M', '6M', 'All'] as TimeRange[]).map(r => `
            <button class="tag-pill ${r === selectedRange ? 'active' : ''}" onclick="setRange('${r}')">${r}</button>
          `).join('')}
        </div>
      </div>

      ${ranking.length === 0 ? `
        <div class="empty-state" style="padding-top:80px">
          <span class="material-symbols-outlined icon">bar_chart</span>
          <p>Noch keine Daten – starte dein erstes Workout!</p>
        </div>
      ` : `
        <!-- Summary Stats -->
        <section style="padding:0 20px 12px">
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
            <div class="glass" style="padding:12px;border-radius:var(--radius);text-align:center">
              <p style="font-size:1.5rem;font-family:var(--font-mono);color:var(--green);font-weight:600">${allWorkouts.length}</p>
              <p style="font-size:0.65rem;color:var(--text-sub);text-transform:uppercase;letter-spacing:0.06em">Workouts</p>
            </div>
            <div class="glass" style="padding:12px;border-radius:var(--radius);text-align:center">
              <p style="font-size:1.5rem;font-family:var(--font-mono);color:var(--green);font-weight:600">${ranking.length}</p>
              <p style="font-size:0.65rem;color:var(--text-sub);text-transform:uppercase;letter-spacing:0.06em">Übungen</p>
            </div>
            <div class="glass" style="padding:12px;border-radius:var(--radius);text-align:center">
              <p style="font-size:1.5rem;font-family:var(--font-mono);color:var(--green);font-weight:600">${ranking.filter(r => r.changePercent > 0).length}</p>
              <p style="font-size:0.65rem;color:var(--text-sub);text-transform:uppercase;letter-spacing:0.06em">Steigerungen</p>
            </div>
          </div>
        </section>

        <!-- Ranking -->
        <section style="padding:0 20px 16px">
          <h2 style="font-weight:700;font-size:1rem;margin-bottom:10px">🏆 Steigerungsranking</h2>
          <div style="display:flex;flex-direction:column;gap:8px">
            ${ranking.map((p, i) => {
    const isPos = p.changePercent >= 0;
    const rankClass = i === 0 ? 'rank-1' : i === 1 ? 'rank-2' : i === 2 ? 'rank-3' : 'rank-n';
    const barPct = Math.min(100, Math.abs(p.changePercent) * 3.5);
    const cb = p.currentBest;
    const pb = p.previousBest;
    const isSelected = p.name === selectedExercise;
    return `
                <div class="glass ${isSelected ? 'glass-glow' : ''}"
                  style="padding:14px 16px;border-radius:var(--radius);cursor:pointer;transition:all 0.2s"
                  onclick="selectExercise('${encodeURIComponent(p.name)}')">
                  <div class="flex items-center gap-3" style="margin-bottom:8px">
                    <div class="rank-badge ${rankClass}">${i + 1}</div>
                    <div style="flex:1;min-width:0">
                      <div class="flex items-center justify-between">
                        <span style="font-weight:700;font-size:0.88rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:160px">${p.name}</span>
                        <span style="font-weight:800;font-size:0.9rem;color:${isPos ? 'var(--green)' : 'var(--red)'};white-space:nowrap">
                          ${isPos ? '↑' : '↓'} ${Math.abs(p.changePercent).toFixed(1)}%
                        </span>
                      </div>
                      ${cb && pb ? `<p style="font-size:0.68rem;color:var(--text-sub);font-family:var(--font-mono);margin-top:2px">${fmtKg(pb.weight)} × ${pb.reps} → ${fmtKg(cb.weight)} × ${cb.reps}</p>` : ''}
                    </div>
                  </div>
                  <div class="prog-bar">
                    <div class="prog-bar__fill" style="width:${barPct}%;background:${isPos ? 'var(--green)' : 'var(--red)'}"></div>
                  </div>
                </div>
              `;
  }).join('')}
          </div>
        </section>

        <!-- Chart -->
        ${selectedExercise ? `
        <section style="padding:0 20px 24px">
          <div class="flex items-center justify-between" style="margin-bottom:10px">
            <h2 style="font-weight:700;font-size:0.95rem">${selectedExercise}</h2>
            <div class="flex gap-2">
              ${(['weight', 'volume', '1rm'] as const).map(m => `
                <button class="tag-pill ${m === chartMode ? 'active' : ''}" onclick="setChartMode('${m}')">
                  ${m === 'weight' ? 'Gewicht' : m === 'volume' ? 'Volumen' : '1RM'}
                </button>
              `).join('')}
            </div>
          </div>
          <div class="glass" style="padding:16px;border-radius:var(--radius)">
            <div class="chart-container">
              <canvas id="progress-chart"></canvas>
            </div>
          </div>
        </section>
        ` : ''}
      `}
    </div>
  `;

  if (selectedExercise) {
    const exLogs = filtered.get(selectedExercise) ?? [];
    await drawChart(exLogs, allWorkouts, wMap);
  }

  (window as any).setRange = async (r: TimeRange) => {
    selectedRange = r;
    await renderStatistics(container);
  };

  (window as any).selectExercise = async (exEnc: string) => {
    selectedExercise = decodeURIComponent(exEnc);
    chartMode = 'weight';
    await renderStatistics(container);
  };

  (window as any).setChartMode = async (m: 'weight' | 'volume' | '1rm') => {
    chartMode = m;
    const exLogs = filtered.get(selectedExercise!) ?? [];
    await drawChart(exLogs, allWorkouts, wMap);
    // Update active pill
    document.querySelectorAll('#page-stats .tag-pill').forEach(btn => {
      const txt = (btn as HTMLElement).textContent?.trim() ?? '';
      const map: Record<string, string> = { 'weight': 'Gewicht', 'volume': 'Volumen', '1rm': '1RM' };
      btn.classList.toggle('active', map[m] === txt);
    });
  };
}

async function drawChart(exLogs: ExerciseLog[], _workouts: Workout[], wMap: Map<number, Workout>) {
  const canvas = document.getElementById('progress-chart') as HTMLCanvasElement | null;
  if (!canvas) return;
  if (activeChart) { activeChart.destroy(); activeChart = null; }

  const sortedLogs = [...exLogs].sort((a, b) => {
    const da = wMap.get(a.workoutId)?.date ?? '';
    const db2 = wMap.get(b.workoutId)?.date ?? '';
    return da.localeCompare(db2);
  });

  const labels = sortedLogs.map(l => formatShortDate(wMap.get(l.workoutId)?.date ?? ''));
  const data = sortedLogs.map(l => {
    const sets = l.sets.filter(s => s.completed || s.weight > 0);
    if (!sets.length) return 0;
    if (chartMode === 'volume') return bestVolume(sets);
    const best = sets.reduce((b, s) => {
      const rm = s.weight * (1 + s.reps / 30);
      return rm > b.rm ? { rm, s } : b;
    }, { rm: 0, s: sets[0] });
    if (chartMode === '1rm') return parseFloat(best.rm.toFixed(1));
    return best.s.weight;
  });

  const green = '#39ff14';

  activeChart = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        data,
        borderColor: green,
        backgroundColor: 'rgba(57,255,20,0.07)',
        borderWidth: 2.5,
        pointBackgroundColor: green,
        pointRadius: 4,
        pointHoverRadius: 6,
        tension: 0.35,
        fill: true,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }, tooltip: {
          backgroundColor: '#16161f',
          borderColor: 'rgba(57,255,20,0.3)',
          borderWidth: 1,
          titleColor: '#39ff14',
          bodyColor: '#f2f2f5',
          padding: 10,
        }
      },
      scales: {
        x: { ticks: { color: '#8888a0', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.04)' } },
        y: { ticks: { color: '#8888a0', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.04)' } },
      },
    },
  });
}

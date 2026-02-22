import { getAllBodyWeights } from '../db';
import { calculateWeeklyBodyWeight, getBodyWeightTrend } from '../utils/progression';
import { formatShortDate } from '../utils/formatters';
import { Chart, LineController, LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Filler } from 'chart.js';

Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Filler);

let activeChart: Chart | null = null;
let container: HTMLElement;

export async function renderBodyWeight(el: HTMLElement) {
  container = el;
  const allWeights = await getAllBodyWeights();
  const weeklyStats = calculateWeeklyBodyWeight(allWeights);
  const trend = getBodyWeightTrend(allWeights);

  const currentWeight = allWeights.length > 0 ? allWeights[0].weight : 0;
  const avgWeight = allWeights.length > 0 ? allWeights.reduce((t, w) => t + w.weight, 0) / allWeights.length : 0;
  const minWeight = allWeights.length > 0 ? Math.min(...allWeights.map(w => w.weight)) : 0;
  const maxWeight = allWeights.length > 0 ? Math.max(...allWeights.map(w => w.weight)) : 0;

  container.innerHTML = `
    <div class="page fade-in" id="page-bodyweight">
      <div class="bg-glow"></div>
      <div class="page-header">
        <h1 class="section-title" style="font-size:2.2rem">Körpergewicht</h1>
      </div>

      ${allWeights.length === 0 ? `
        <div class="empty-state" style="padding-top:80px">
          <span class="material-symbols-outlined icon">scale</span>
          <p>Noch keine Gewichtsdaten – starte mit deinem ersten Eintrag!</p>
        </div>
      ` : `
        <!-- Summary Stats -->
        <section style="padding:0 20px 12px">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
            <div class="glass" style="padding:12px;border-radius:var(--radius);text-align:center">
              <p style="font-size:0.65rem;color:var(--text-sub);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px">Aktuell</p>
              <p style="font-size:1.6rem;font-family:var(--font-mono);color:var(--green);font-weight:600">${currentWeight.toFixed(1)}</p>
              <p style="font-size:0.65rem;color:var(--text-sub)">kg</p>
            </div>
            <div class="glass" style="padding:12px;border-radius:var(--radius);text-align:center">
              <p style="font-size:0.65rem;color:var(--text-sub);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px">Schnitt</p>
              <p style="font-size:1.6rem;font-family:var(--font-mono);color:var(--green);font-weight:600">${avgWeight.toFixed(1)}</p>
              <p style="font-size:0.65rem;color:var(--text-sub)">kg</p>
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
            <div class="glass" style="padding:12px;border-radius:var(--radius);text-align:center">
              <p style="font-size:0.65rem;color:var(--text-sub);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px">Tiefstwert</p>
              <p style="font-size:1.4rem;font-family:var(--font-mono);color:var(--green);font-weight:600">${minWeight.toFixed(1)}</p>
              <p style="font-size:0.65rem;color:var(--text-sub)">kg</p>
            </div>
            <div class="glass" style="padding:12px;border-radius:var(--radius);text-align:center">
              <p style="font-size:0.65rem;color:var(--text-sub);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px">Höchstwert</p>
              <p style="font-size:1.4rem;font-family:var(--font-mono);color:var(--red);font-weight:600">${maxWeight.toFixed(1)}</p>
              <p style="font-size:0.65rem;color:var(--text-sub)">kg</p>
            </div>
          </div>
        </section>

        <!-- Trend -->
        <section style="padding:16px 20px">
          <h2 style="font-weight:700;font-size:1rem;margin-bottom:10px">Trend</h2>
          <div class="glass" style="padding:16px;border-radius:var(--radius)">
            <div class="flex items-center gap-3">
              <span class="material-symbols-outlined" style="font-size:32px;color:${trend > 0 ? 'var(--red)' : 'var(--green)'}">${trend > 0 ? 'trending_up' : 'trending_down'}</span>
              <div>
                <p style="font-size:1.4rem;font-family:var(--font-mono);color:${trend > 0 ? 'var(--red)' : 'var(--green)'};font-weight:600">
                  ${trend > 0 ? '+' : ''}${trend.toFixed(1)}%
                </p>
                <p style="font-size:0.75rem;color:var(--text-sub)">vom ersten zum letzten Eintrag</p>
              </div>
            </div>
          </div>
        </section>

        <!-- Chart -->
        <section style="padding:0 20px 24px">
          <h2 style="font-weight:700;font-size:1rem;margin-bottom:10px">Entwicklung</h2>
          <div class="glass" style="padding:16px;border-radius:var(--radius)">
            <div class="chart-container">
              <canvas id="bodyweight-chart"></canvas>
            </div>
          </div>
        </section>

        <!-- Weekly Average -->
        <section style="padding:0 20px 24px">
          <h2 style="font-weight:700;font-size:1rem;margin-bottom:10px">Wöchentliche Durchschnitte</h2>
          <div style="display:flex;flex-direction:column;gap:8px">
            ${weeklyStats.map((week) => {
              const isLatest = week === weeklyStats[weeklyStats.length - 1];
              return `
                <div class="glass ${isLatest ? 'glass-glow' : ''}" style="padding:12px 16px;border-radius:var(--radius)">
                  <div class="flex items-center justify-between">
                    <div>
                      <p style="font-weight:600;font-size:0.9rem">Woche vom ${formatShortDate(week.week)}</p>
                      <p style="font-size:0.72rem;color:var(--text-sub)">${week.count} Eintrag${week.count > 1 ? 'e' : ''}</p>
                    </div>
                    <div style="text-align:right">
                      <p style="font-family:var(--font-mono);font-size:1.1rem;color:var(--green);font-weight:600">${week.average.toFixed(1)}</p>
                      <p style="font-size:0.65rem;color:var(--text-sub)">${week.min.toFixed(1)} - ${week.max.toFixed(1)}</p>
                    </div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </section>
      `}
    </div>
  `;

  if (allWeights.length > 0) {
    drawChart(allWeights);
  }
}

async function drawChart(weights: typeof getAllBodyWeights extends () => Promise<infer T> ? T : any) {
  const canvas = document.getElementById('bodyweight-chart') as HTMLCanvasElement | null;
  if (!canvas) return;
  if (activeChart) { activeChart.destroy(); activeChart = null; }

  // Sort by date ascending (oldest first)
  const sorted = [...weights].sort((a, b) => a.date.localeCompare(b.date));

  const labels = sorted.map(w => formatShortDate(w.date));
  const data = sorted.map(w => w.weight);

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
        pointRadius: 3,
        pointHoverRadius: 5,
        tension: 0.35,
        fill: true,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#16161f',
          borderColor: 'rgba(57,255,20,0.3)',
          borderWidth: 1,
          titleColor: '#39ff14',
          bodyColor: '#f2f2f5',
          padding: 10,
          callbacks: {
            label: (context) => {
              const value = context.parsed?.y;
              return value ? `${value.toFixed(1)} kg` : '–';
            }
          }
        }
      },
      scales: {
        x: { ticks: { color: '#8888a0', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.04)' } },
        y: { ticks: { color: '#8888a0', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.04)' } },
      },
    },
  });
}

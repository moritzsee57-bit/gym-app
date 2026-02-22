import { initDB, type Split } from './db';
import { renderDashboard } from './pages/dashboard';
import { renderWorkoutSelect } from './pages/workout-select';
import { renderActiveWorkout, setActiveSplit } from './pages/active-workout';
import { renderStatistics } from './pages/statistics';
import { renderProfile } from './pages/profile';
import { renderBodyWeight } from './pages/body-weight';
import './styles/main.css';

// ─── Service Worker Registration ──────────────────────────────────────────────
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/service-worker.js').then((reg) => {
    console.log('Service Worker registered:', reg);
  }).catch((err) => {
    console.log('Service Worker registration failed:', err);
  });
}

// ─── Types ────────────────────────────────────────────────────────────────────
export type Page = 'dashboard' | 'workout' | 'active-workout' | 'statistics' | 'profile' | 'body-weight';

// ─── State ────────────────────────────────────────────────────────────────────
let currentPage: Page = 'dashboard';
let container: HTMLElement;

// ─── Navigation ───────────────────────────────────────────────────────────────
export function navigate(page: Page | string) {
    currentPage = page as Page;
    renderPage();
    updateNav();
}

export function setActiveWorkoutSplit(split: Split) {
    setActiveSplit(split);
}

// ─── Toast ────────────────────────────────────────────────────────────────────
export function showToast(msg: string, durationMs = 2500) {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), durationMs);
}

// Make available globally for inline handlers
(window as any).showToast = showToast;
(window as any).navigate = navigate;

// ─── Render ───────────────────────────────────────────────────────────────────
async function renderPage() {
    if (!container) return;
    container.innerHTML = '';
    switch (currentPage) {
        case 'dashboard': await renderDashboard(container); break;
        case 'workout': await renderWorkoutSelect(container); break;
        case 'active-workout': await renderActiveWorkout(container); break;
        case 'statistics': await renderStatistics(container); break;
        case 'body-weight': await renderBodyWeight(container); break;
        case 'profile': await renderProfile(container); break;
        default: await renderDashboard(container);
    }
}

// ─── Nav bar ──────────────────────────────────────────────────────────────────
function buildNav(): HTMLElement {
    const nav = document.createElement('nav');
    nav.id = 'nav';
    nav.innerHTML = `
    <div class="nav-inner">
      <button class="nav-item" data-page="dashboard" onclick="navigate('dashboard')">
        <span class="material-symbols-outlined">home</span>
        Home
      </button>
      <button class="nav-item" data-page="statistics" onclick="navigate('statistics')">
        <span class="material-symbols-outlined">bar_chart</span>
        Stats
      </button>
      <button class="nav-item" data-page="body-weight" onclick="navigate('body-weight')">
        <span class="material-symbols-outlined">scale</span>
        Gewicht
      </button>
      <button class="nav-item" data-page="workout" onclick="navigate('workout')"
        style="color:var(--green)">
        <span class="material-symbols-outlined" style="font-size:32px;font-variation-settings:'FILL' 1">add_circle</span>
        Workout
      </button>
      <button class="nav-item" data-page="profile" onclick="navigate('profile')">
        <span class="material-symbols-outlined">person</span>
        Profil
      </button>
    </div>
  `;
    return nav;
}

function updateNav() {
    document.querySelectorAll('#nav .nav-item[data-page]').forEach(item => {
        const page = item.getAttribute('data-page');
        const isActive = page === currentPage || (page === 'workout' && currentPage === 'active-workout');
        item.classList.toggle('active', isActive);
    });
}

// ─── Bootstrap ───────────────────────────────────────────────────────────────
async function main() {
    const app = document.getElementById('app')!;

    // Static background glow
    const bgEl = document.createElement('div');
    bgEl.className = 'bg-glow';
    app.appendChild(bgEl);

    // Page container
    container = document.createElement('div');
    container.id = 'page-container';
    app.appendChild(container);

    // Bottom nav
    const nav = buildNav();
    document.body.appendChild(nav);

    // Expose navigate globally (for inline onclick handlers across pages)
    (window as any).navigate = navigate;
    (window as any).showToast = showToast;

    // Init DB first
    await initDB();

    // Render initial page
    await renderPage();
    updateNav();
}

main().catch(console.error);

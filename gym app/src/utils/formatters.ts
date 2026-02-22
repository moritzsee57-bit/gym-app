// ─── Date / Time ─────────────────────────────────────────────────────────────
export function formatDate(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString('de-DE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

export function formatShortDate(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

export function todayISO(): string {
    return new Date().toISOString();
}

export function formatDuration(ms: number): string {
    const s = Math.round(ms / 1000);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    if (h > 0) return `${h}h ${m % 60}min`;
    return `${m}min`;
}

export function formatElapsed(ms: number): string {
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60).toString().padStart(2, '0');
    const s = (totalSec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}

// ─── Weight / Percent ─────────────────────────────────────────────────────────
export function fmtKg(kg: number): string {
    return kg % 1 === 0 ? `${kg}kg` : `${kg.toFixed(1)}kg`;
}

export function fmtPercent(pct: number): string {
    const sign = pct >= 0 ? '+' : '';
    return `${sign}${pct.toFixed(1)}%`;
}

export function fmtVolume(kg: number): string {
    if (kg >= 1000) return `${(kg / 1000).toFixed(1)}t`;
    return `${kg.toFixed(0)}kg`;
}

// ─── Greeting ─────────────────────────────────────────────────────────────────
export function greeting(): string {
    const h = new Date().getHours();
    if (h < 12) return 'Guten Morgen';
    if (h < 18) return 'Guten Tag';
    return 'Guten Abend';
}

// ─── Timer ────────────────────────────────────────────────────────────────────
export function formatCountdown(sec: number): string {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}

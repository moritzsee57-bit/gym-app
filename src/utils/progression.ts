import type { SetEntry, ExerciseLog, BodyWeightEntry } from '../db';

// ─── Epley 1RM ───────────────────────────────────────────────────────────────
export function epley1RM(weight: number, reps: number): number {
    if (reps === 1) return weight;
    if (reps <= 0 || weight <= 0) return 0;
    return weight * (1 + reps / 30);
}

// ─── Best set from a log ──────────────────────────────────────────────────────
export function bestSet(sets: SetEntry[]): SetEntry | null {
    const done = sets.filter(s => s.completed && s.weight > 0 && s.reps > 0);
    if (!done.length) return null;
    return done.reduce((best, s) => epley1RM(s.weight, s.reps) > epley1RM(best.weight, best.reps) ? s : best);
}

export function bestVolume(sets: SetEntry[]): number {
    return sets.filter(s => s.completed).reduce((t, s) => t + s.weight * s.reps, 0);
}

// ─── Per-exercise progression ─────────────────────────────────────────────────
export interface ExerciseProgress {
    name: string;
    muscleGroup: string;
    current1RM: number;
    previous1RM: number;
    changePercent: number;        // positive = improvement
    currentBest: SetEntry | null;
    previousBest: SetEntry | null;
    allLogs: ExerciseLog[];       // chronological
}

/**
 * Build progression data for a single exercise given its logs (sorted oldest→newest).
 */
export function buildProgress(name: string, logs: ExerciseLog[]): ExerciseProgress {
    const muscleGroup = logs[0]?.muscleGroup ?? '';
    if (logs.length < 2) {
        const last = logs[logs.length - 1];
        const b = last ? bestSet(last.sets) : null;
        const rm = b ? epley1RM(b.weight, b.reps) : 0;
        return { name, muscleGroup, current1RM: rm, previous1RM: rm, changePercent: 0, currentBest: b, previousBest: b, allLogs: logs };
    }
    const cur = logs[logs.length - 1];
    const prev = logs[logs.length - 2];
    const cb = bestSet(cur.sets);
    const pb = bestSet(prev.sets);
    const c1rm = cb ? epley1RM(cb.weight, cb.reps) : 0;
    const p1rm = pb ? epley1RM(pb.weight, pb.reps) : 0;
    const pct = p1rm > 0 ? ((c1rm - p1rm) / p1rm) * 100 : 0;
    return { name, muscleGroup, current1RM: c1rm, previous1RM: p1rm, changePercent: pct, currentBest: cb, previousBest: pb, allLogs: logs };
}

/**
 * Build progression for ALL exercises and return them sorted by improvement (desc).
 */
export function buildRanking(logsByExercise: Map<string, ExerciseLog[]>): ExerciseProgress[] {
    const results: ExerciseProgress[] = [];
    for (const [name, logs] of logsByExercise.entries()) {
        if (logs.length > 0) results.push(buildProgress(name, logs));
    }
    return results.sort((a, b) => b.changePercent - a.changePercent);
}

// ─── Group logs by exercise name ──────────────────────────────────────────────
export function groupByExercise(all: ExerciseLog[]): Map<string, ExerciseLog[]> {
    const map = new Map<string, ExerciseLog[]>();
    for (const l of all) {
        if (!map.has(l.exerciseName)) map.set(l.exerciseName, []);
        map.get(l.exerciseName)!.push(l);
    }
    return map;
}

// ─── Streak ───────────────────────────────────────────────────────────────────
export function calcStreak(workoutDates: string[]): number {
    if (!workoutDates.length) return 0;
    const days = [...new Set(workoutDates.map(d => d.slice(0, 10)))].sort().reverse();
    let streak = 0;
    let expected = new Date();
    expected.setHours(0, 0, 0, 0);
    for (const d of days) {
        const date = new Date(d);
        date.setHours(0, 0, 0, 0);
        const diff = Math.round((expected.getTime() - date.getTime()) / 86400000);
        if (diff <= 1) { streak++; expected = date; }
        else break;
    }
    return streak;
}

// ─── Weekly volume ────────────────────────────────────────────────────────────
export function weeklyVolume(logs: ExerciseLog[]): number {
    // We don't have dates on logs directly – caller must filter
    return logs.reduce((t, l) => t + bestVolume(l.sets), 0);
}

// ─── Body Weight Statistics ───────────────────────────────────────────────────
export interface WeeklyBodyWeight {
  week: string;         // ISO week start date
  average: number;      // average weight for the week
  min: number;
  max: number;
  count: number;        // number of entries
}

export function calculateWeeklyBodyWeight(entries: BodyWeightEntry[]): WeeklyBodyWeight[] {
    if (entries.length === 0) return [];
    
    const weeklies = new Map<string, BodyWeightEntry[]>();
    
    for (const entry of entries) {
        const date = new Date(entry.date);
        const dayOfWeek = date.getDay();
        const diff = date.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
        const weekStart = new Date(date.setDate(diff));
        const weekKey = weekStart.toISOString().split('T')[0];
        
        if (!weeklies.has(weekKey)) weeklies.set(weekKey, []);
        weeklies.get(weekKey)!.push(entry);
    }
    
    const result: WeeklyBodyWeight[] = [];
    for (const [week, entries] of weeklies) {
        const weights = entries.map(e => e.weight);
        result.push({
            week,
            average: weights.reduce((a, b) => a + b, 0) / weights.length,
            min: Math.min(...weights),
            max: Math.max(...weights),
            count: weights.length,
        });
    }
    
    return result.sort((a, b) => a.week.localeCompare(b.week));
}

export function getBodyWeightTrend(entries: BodyWeightEntry[]): number {
    if (entries.length < 2) return 0;
    
    // Sort by date ascending (oldest first)
    const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
    const first = sorted[0].weight;
    const last = sorted[sorted.length - 1].weight;
    
    return ((last - first) / first) * 100;
}

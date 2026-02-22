import { openDB, type IDBPDatabase } from 'idb';

// ─── Types ────────────────────────────────────────────────────────────────────
export interface SetEntry {
  setNumber: number;
  weight: number;
  reps: number;
  completed: boolean;
}

export interface ExerciseLog {
  id?: number;
  workoutId: number;
  exerciseName: string;
  muscleGroup: string;
  sets: SetEntry[];
}

export interface Workout {
  id?: number;
  splitName: string;
  date: string;          // ISO string
  durationMs: number;
  notes?: string;
}

export interface Split {
  id?: number;
  name: string;
  emoji: string;
  exercises: string[];   // ordered list of exercise names
  muscleGroups: string[];
}

export interface UserProfile {
  id?: number;
  name: string;
  createdAt: string;
  defaultRestSec: number;
}

export interface BodyWeightEntry {
  id?: number;
  weight: number;      // in kg
  date: string;        // ISO string
  notes?: string;
}

// ─── DB Setup ────────────────────────────────────────────────────────────────
let db: IDBPDatabase;

export async function initDB() {
  db = await openDB('gymtracker', 3, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        db.createObjectStore('workouts', { keyPath: 'id', autoIncrement: true });
        const ex = db.createObjectStore('exerciseLogs', { keyPath: 'id', autoIncrement: true });
        ex.createIndex('workoutId', 'workoutId');
        ex.createIndex('exerciseName', 'exerciseName');
        db.createObjectStore('splits', { keyPath: 'id', autoIncrement: true });
        db.createObjectStore('profile', { keyPath: 'id' });
      }
      if (oldVersion < 3) {
        if (!db.objectStoreNames.contains('bodyWeights')) {
          const bw = db.createObjectStore('bodyWeights', { keyPath: 'id', autoIncrement: true });
          bw.createIndex('date', 'date');
        }
      }
    },
  });

  // Seed default profile if needed
  const p = await db.get('profile', 1);
  if (!p) {
    await db.put('profile', {
      id: 1,
      name: 'Athlet',
      createdAt: new Date().toISOString(),
      defaultRestSec: 180,
    });
  }

  // Seed default splits if empty
  const splits = await db.getAll('splits');
  if (splits.length === 0) {
    const defaults: Omit<Split, 'id'>[] = [
      { name: 'Push Day', emoji: '💪', exercises: ['Bankdrücken', 'Schulterdrücken', 'Schrägbankdrücken', 'Seitheben', 'Trizepsdrücken'], muscleGroups: ['Brust', 'Schulter', 'Trizeps'] },
      { name: 'Pull Day', emoji: '🏋️', exercises: ['Klimmzüge', 'Langhantelrudern', 'Kabelrudern', 'Bizepscurls', 'Gesichtsziehen'], muscleGroups: ['Rücken', 'Bizeps'] },
      { name: 'Leg Day', emoji: '🦵', exercises: ['Kniebeugen', 'Beinpresse', 'Rumänisches Kreuzheben', 'Beinbeuger', 'Wadenheben'], muscleGroups: ['Quadrizeps', 'Hamstrings', 'Waden'] },
      { name: 'Upper Body', emoji: '🔝', exercises: ['Bankdrücken', 'Klimmzüge', 'Schulterdrücken', 'Rudern', 'Bizepscurls', 'Trizeps'], muscleGroups: ['Oberkörper'] },
      { name: 'Lower Body', emoji: '⚡', exercises: ['Kniebeugen', 'Kreuzheben', 'Ausfallschritte', 'Beinpresse', 'Wadenheben'], muscleGroups: ['Unterkörper'] },
    ];
    for (const s of defaults) await db.add('splits', s);
  }

  return db;
}

// ─── Workouts ────────────────────────────────────────────────────────────────
export async function addWorkout(w: Omit<Workout, 'id'>): Promise<number> {
  return db.add('workouts', w) as Promise<number>;
}

export async function updateWorkout(w: Workout) {
  return db.put('workouts', w);
}

export async function getAllWorkouts(): Promise<Workout[]> {
  const all = await db.getAll('workouts') as Workout[];
  return all.sort((a, b) => b.date.localeCompare(a.date));
}

export async function deleteWorkout(id: number) {
  await db.delete('workouts', id);
  const logs = await db.getAllFromIndex('exerciseLogs', 'workoutId', id);
  for (const l of logs) await db.delete('exerciseLogs', (l as ExerciseLog).id!);
}

// ─── Exercise Logs ───────────────────────────────────────────────────────────
export async function addExerciseLog(log: Omit<ExerciseLog, 'id'>): Promise<number> {
  return db.add('exerciseLogs', log) as Promise<number>;
}

export async function updateExerciseLog(log: ExerciseLog) {
  return db.put('exerciseLogs', log);
}

export async function getLogsForWorkout(workoutId: number): Promise<ExerciseLog[]> {
  return db.getAllFromIndex('exerciseLogs', 'workoutId', workoutId) as Promise<ExerciseLog[]>;
}

export async function getLogsByExercise(exerciseName: string): Promise<ExerciseLog[]> {
  const logs = await db.getAllFromIndex('exerciseLogs', 'exerciseName', exerciseName) as ExerciseLog[];
  // Sort by date: get each workout's date
  const workouts = await getAllWorkouts();
  const wMap = new Map(workouts.map(w => [w.id!, w.date]));
  return logs.sort((a, b) => (wMap.get(a.workoutId) ?? '').localeCompare(wMap.get(b.workoutId) ?? ''));
}

export async function getAllExerciseLogs(): Promise<ExerciseLog[]> {
  return db.getAll('exerciseLogs') as Promise<ExerciseLog[]>;
}

// ─── Splits ──────────────────────────────────────────────────────────────────
export async function getAllSplits(): Promise<Split[]> {
  return db.getAll('splits') as Promise<Split[]>;
}

export async function addSplit(s: Omit<Split, 'id'>): Promise<number> {
  return db.add('splits', s) as Promise<number>;
}

export async function deleteSplit(id: number) {
  return db.delete('splits', id);
}

// ─── Profile ─────────────────────────────────────────────────────────────────
export async function getProfile(): Promise<UserProfile> {
  return db.get('profile', 1) as Promise<UserProfile>;
}

export async function updateProfile(p: UserProfile) {
  return db.put('profile', p);
}

// ─── Body Weight ────────────────────────────────────────────────────────────
export async function addBodyWeight(weight: number, notes?: string): Promise<number> {
  return db.add('bodyWeights', {
    weight,
    date: new Date().toISOString(),
    notes,
  }) as Promise<number>;
}

export async function getAllBodyWeights(): Promise<BodyWeightEntry[]> {
  const all = await db.getAll('bodyWeights') as BodyWeightEntry[];
  return all.sort((a, b) => b.date.localeCompare(a.date));
}

export async function deleteBodyWeight(id: number) {
  return db.delete('bodyWeights', id);
}

// ─── Nuke Everything ─────────────────────────────────────────────────────────
export async function clearAllData() {
  await db.clear('workouts');
  await db.clear('exerciseLogs');
  await db.clear('splits');
  await db.clear('bodyWeights');
  await db.clear('profile');
  // Re-seed
  await db.put('profile', { id: 1, name: 'Athlet', createdAt: new Date().toISOString(), defaultRestSec: 180 });
}

// ─── Export / Import ─────────────────────────────────────────────────────────
export async function exportData(): Promise<string> {
  const data = {
    workouts: await db.getAll('workouts'),
    exerciseLogs: await db.getAll('exerciseLogs'),
    splits: await db.getAll('splits'),
    bodyWeights: await db.getAll('bodyWeights'),
    profile: await db.getAll('profile'),
    exportedAt: new Date().toISOString(),
  };
  return JSON.stringify(data, null, 2);
}

export async function importData(json: string) {
  const data = JSON.parse(json);
  for (const w of data.workouts ?? [])      await db.put('workouts', w);
  for (const l of data.exerciseLogs ?? [])  await db.put('exerciseLogs', l);
  for (const s of data.splits ?? [])        await db.put('splits', s);
  for (const bw of data.bodyWeights ?? [])  await db.put('bodyWeights', bw);
  for (const p of data.profile ?? [])       await db.put('profile', p);
}

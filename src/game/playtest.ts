// A small log of first-session moments that a tester can copy and send.
// Times are in seconds of active play, so a tester who pauses doesn't skew the numbers.

export type PlaytestEvent =
  | 'plant'
  | 'harvest'
  | 'plot'
  | 'kolhu-start'
  | 'kolhu-collect'
  | 'order'
  | 'dismiss'
  | 'level'
  | 'diwali'
  | 'reset';

export interface PlaytestEntry {
  t: number;
  event: PlaytestEvent;
  detail?: string;
}

export interface PlaytestLog {
  version: 1;
  startedAt: number;
  playSeconds: number;
  sessions: number;
  entries: PlaytestEntry[];
}

const MAX_ENTRIES = 600;

export function newLog(now: number): PlaytestLog {
  return { version: 1, startedAt: now, playSeconds: 0, sessions: 1, entries: [] };
}

export function record(log: PlaytestLog, event: PlaytestEvent, detail?: string): void {
  if (log.entries.length >= MAX_ENTRIES) return;
  log.entries.push({ t: Math.round(log.playSeconds), event, ...(detail ? { detail } : {}) });
}

export function addPlayTime(log: PlaytestLog, seconds: number): void {
  log.playSeconds += seconds;
}

const MILESTONES: [string, (e: PlaytestEntry) => boolean][] = [
  ['First planting', (e) => e.event === 'plant'],
  ['First harvest', (e) => e.event === 'harvest'],
  ['First order filled', (e) => e.event === 'order'],
  ['First land cleared', (e) => e.event === 'plot'],
  ['Level 2', (e) => e.event === 'level' && e.detail === '2'],
  ['Level 3', (e) => e.event === 'level' && e.detail === '3'],
  ['First jaggery', (e) => e.event === 'kolhu-collect'],
  ['Level 4', (e) => e.event === 'level' && e.detail === '4'],
  ['Diwali (level 5)', (e) => e.event === 'diwali'],
];

export function clock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** A plain-text report short enough to paste into a chat message. */
export function report(log: PlaytestLog, device: string): string {
  const count = (event: PlaytestEvent) => log.entries.filter((e) => e.event === event).length;
  const lines = [
    'Little Village Story · playtest report',
    `Play time: ${clock(log.playSeconds)} over ${log.sessions} session${log.sessions === 1 ? '' : 's'}`,
    '',
    'Reached at (play time):',
  ];
  for (const [name, match] of MILESTONES) {
    const hit = log.entries.find(match);
    lines.push(`- ${name}: ${hit ? clock(hit.t) : 'not yet'}`);
  }
  lines.push(
    '',
    `Orders filled: ${count('order')} · sent away: ${count('dismiss')}`,
    `Harvests: ${count('harvest')} · land cleared: ${count('plot')} · jaggery made: ${count('kolhu-collect')}`,
    `Restarts: ${count('reset')}`,
    '',
    `Device: ${device}`,
  );
  return lines.join('\n');
}

export function restoreLog(raw: unknown, now: number): PlaytestLog {
  const r = raw as PlaytestLog | null;
  if (!r || r.version !== 1 || !Array.isArray(r.entries)) return newLog(now);
  return { ...r, sessions: (r.sessions ?? 0) + 1 };
}

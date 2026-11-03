import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow, NightLog, ReadNight, RunStatus } from './types.js';

type Entry = { at: string; job: string; status: RunStatus; owner: string | null; error: string | null };

const NIGHT = /^\d{4}-\d{2}-\d{2}$/;
// ISO time with an explicit offset (or Z), as the log writes it.
const AT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

export function isNight(night: string): boolean {
  return NIGHT.test(night);
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isStatus(v: unknown): v is RunStatus {
  return v === 'ok' || v === 'retry' || v === 'fail';
}

// One log line → an entry, or null if it isn't a valid one. The edge: nothing past here is unchecked.
export function parseLine(line: string): Entry | null {
  let v: unknown;
  try {
    v = JSON.parse(line);
  } catch {
    return null;
  }
  if (!isRecord(v)) return null;
  const { at, job, status, owner, error } = v;
  if (typeof at !== 'string' || !AT.test(at) || Number.isNaN(Date.parse(at))) return null;
  if (typeof job !== 'string' || job.trim() === '') return null;
  if (!isStatus(status)) return null;
  if (owner !== null && typeof owner !== 'string') return null;
  if (error !== undefined && error !== null && typeof error !== 'string') return null;
  return { at, job, status, owner, error: error ?? null };
}

// Folds entries (in log order) into one row per job, sorted by job.
export function digest(entries: Entry[]): DigestRow[] {
  const rows = new Map<string, DigestRow>();
  for (const e of entries) {
    const row = rows.get(e.job);
    if (!row) {
      rows.set(e.job, {
        job: e.job,
        owner: e.owner,
        runs: 1,
        retries: e.status === 'retry' ? 1 : 0,
        fails: e.status === 'fail' ? 1 : 0,
        lastStatus: e.status,
        lastError: e.error,
        firstAt: e.at,
        lastAt: e.at,
      });
      continue;
    }
    row.owner = e.owner;
    row.runs += 1;
    if (e.status === 'retry') row.retries += 1;
    if (e.status === 'fail') row.fails += 1;
    row.lastStatus = e.status;
    if (e.error !== null) row.lastError = e.error;
    row.lastAt = e.at;
  }
  return [...rows.values()].sort((a, b) => (a.job < b.job ? -1 : a.job > b.job ? 1 : 0));
}

export const readNight: ReadNight = (runsDir, night) => {
  if (!isNight(night)) return null;
  let text: string;
  try {
    text = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  } catch (err) {
    if (isRecord(err) && (err.code === 'ENOENT' || err.code === 'ENOTDIR')) return null;
    throw err;
  }
  const entries: Entry[] = [];
  let badLines = 0;
  for (const line of text.split(/\r?\n/)) {
    if (line.trim() === '') continue;
    const entry = parseLine(line);
    if (entry) entries.push(entry);
    else badLines += 1;
  }
  return { night, rows: digest(entries), badLines };
};

// Log lines per status across a night's rows (for the board's ok/retry/fail counts).
export function statusCounts(rows: DigestRow[]): Record<RunStatus, number> {
  let retry = 0;
  let fail = 0;
  let total = 0;
  for (const r of rows) {
    retry += r.retries;
    fail += r.fails;
    total += r.runs;
  }
  return { ok: total - retry - fail, retry, fail };
}

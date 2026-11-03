import { readdirSync } from 'node:fs';
import type { RigConfig } from './config.js';
import { readNight, statusCounts } from './digest/read.js';
import { lastBeat, type Beat } from './heartbeat.js';

export type Status = {
  adapter: string;
  installed: string;
  lastBeat: Beat | null;
  nights: NightEntry[];
};

export type NightEntry = {
  night: string;
  counts: { ok: number; retry: number; fail: number } | null;
  badLines: number;
};

// Nights on disk = runs/<YYYY-MM-DD>.jsonl, newest first.
export function nightsOnDisk(runsDir: string): string[] {
  try {
    return readdirSync(runsDir)
      .filter((f) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f))
      .map((f) => f.slice(0, 10))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

export function readStatus(config: RigConfig): Status {
  return {
    adapter: config.adapter,
    installed: config.installed,
    lastBeat: lastBeat(),
    nights: nightsOnDisk(config.runsDir).map((night) => {
      const log = readNight(config.runsDir, night);
      return log
        ? { night, counts: statusCounts(log.rows), badLines: log.badLines }
        : { night, counts: null, badLines: 0 };
    }),
  };
}

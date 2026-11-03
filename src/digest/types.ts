// The night's run log, one row per job. Contract for section 2 (routes, views, board).

export type RunStatus = 'ok' | 'retry' | 'fail';

export type DigestRow = {
  job: string;
  owner: string | null; // null stays null; the view shows `—`
  runs: number; // log lines for this job, every attempt (retries included)
  retries: number; // lines with status `retry`
  fails: number; // lines with status `fail`
  lastStatus: RunStatus; // status of the job's last line
  lastError: string | null; // most recent `error` seen for the job, null if none
  firstAt: string; // `at` of the first line, offset kept as logged (never UTC)
  lastAt: string; // `at` of the last line, offset kept as logged
};

export type NightLog = {
  night: string; // YYYY-MM-DD
  rows: DigestRow[]; // sorted by job; empty when the file is empty ("nothing ran")
  badLines: number; // non-blank lines that aren't a valid run entry; counted, never thrown
};

// Reads `<runsDir>/<night>.jsonl`. Returns null when there is no such file
// (or `night` isn't YYYY-MM-DD, so no such file can exist).
export type ReadNight = (runsDir: string, night: string) => NightLog | null;

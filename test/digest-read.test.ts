import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { parseLine, readNight, statusCounts } from '../src/digest/read.js';

describe('readNight on runs/2026-10-28', () => {
  const log = readNight('runs', '2026-10-28');

  it('gives 5 rows sorted by job and 1 bad line', () => {
    expect(log).not.toBeNull();
    expect(log?.badLines).toBe(1);
    expect(log?.rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
  });

  it('folds retries, keeps the offset and the last error', () => {
    const row = log?.rows.find((r) => r.job === 'fixtures/refresh');
    expect(row).toEqual({
      job: 'fixtures/refresh',
      owner: 'rook',
      runs: 4,
      retries: 3,
      fails: 0,
      lastStatus: 'ok',
      lastError: 'upstream 503',
      firstAt: '2026-10-29T01:30:00+01:00',
      lastAt: '2026-10-29T01:37:00+01:00',
    });
    const sync = log?.rows.find((r) => r.job === 'lane/sync');
    expect(sync).toMatchObject({ runs: 8, retries: 1, lastStatus: 'ok', firstAt: '2026-10-28T23:00:06+01:00' });
  });

  it('keeps a null owner and a fail', () => {
    expect(log?.rows.find((r) => r.job === 'digest/render')?.owner).toBeNull();
    expect(log?.rows.find((r) => r.job === 'notes/backup')).toMatchObject({
      lastStatus: 'fail',
      fails: 1,
      lastError: 'quota exceeded',
    });
  });

  it('counts lines per status', () => {
    expect(statusCounts(log?.rows ?? [])).toEqual({ ok: 10, retry: 4, fail: 1 });
  });
});

describe('readNight on runs/2026-10-27', () => {
  it('reads a clean night', () => {
    const log = readNight('runs', '2026-10-27');
    expect(log?.badLines).toBe(0);
    expect(log?.rows.map((r) => r.job)).toEqual(['fixtures/refresh', 'lane/sync', 'notes/backup', 'rig/rotate-logs']);
    expect(statusCounts(log?.rows ?? [])).toEqual({ ok: 7, retry: 0, fail: 0 });
  });
});

describe('readNight edge cases', () => {
  const dir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('returns null when the night has no file', () => {
    expect(readNight(dir, '2026-01-01')).toBeNull();
    expect(readNight(join(dir, 'nope'), '2026-01-01')).toBeNull();
  });

  it('returns null for a night that is not a date', () => {
    expect(readNight(dir, '../etc/passwd')).toBeNull();
  });

  it('gives no rows and no bad lines for an empty file', () => {
    writeFileSync(join(dir, '2026-01-02.jsonl'), '');
    expect(readNight(dir, '2026-01-02')).toEqual({ night: '2026-01-02', rows: [], badLines: 0 });
  });

  it('counts JSON with invalid fields as bad lines, skips blank lines', () => {
    const lines = [
      '{"at":"2026-01-03T01:00:00+01:00","job":"a","status":"ok","owner":null}',
      '',
      '{"at":"2026-01-03T01:00:00+01:00","job":"a","status":"done","owner":null}',
      '{"at":"2026-01-03T01:00:00+01:00","job":"a","status":"ok"}',
      '{"at":"yesterday","job":"a","status":"ok","owner":"x"}',
      '[1,2]',
      'not json',
    ];
    writeFileSync(join(dir, '2026-01-03.jsonl'), lines.join('\n') + '\n');
    const log = readNight(dir, '2026-01-03');
    expect(log?.badLines).toBe(5);
    expect(log?.rows).toHaveLength(1);
  });
});

describe('parseLine', () => {
  it('rejects a non-string error', () => {
    expect(parseLine('{"at":"2026-01-03T01:00:00Z","job":"a","status":"fail","owner":"x","error":5}')).toBeNull();
  });
});

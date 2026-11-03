import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const line = (o: object) => JSON.stringify(o);

const NORMAL = [
  line({ at: '2026-11-01T01:00:00+01:00', job: 'sync-b', status: 'ok', owner: 'ana', error: null }),
  line({ at: '2026-11-01T01:05:00+01:00', job: 'backup-a', status: 'retry', owner: null, error: 'timeout' }),
  line({ at: '2026-11-01T01:10:00+01:00', job: 'backup-a', status: 'fail', owner: null, error: 'disk full' }),
  line({ at: '2026-11-01T01:15:00+01:00', job: 'cleanup-c', status: 'ok', owner: 'bo', error: null }),
].join('\n') + '\n';

const BAD = [
  line({ at: '2026-11-02T02:00:00+01:00', job: 'job-a', status: 'ok', owner: 'ana', error: null }),
  '{"at":"2026-11-02T02:05:00+01:00","job":"job-b","sta',
  line({ at: '2026-11-02T02:10:00+01:00', job: 'job-c', status: 'ok', owner: 'bo', error: null }),
].join('\n') + '\n';

let dir: string;
let app: ReturnType<typeof createApp>;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'rig-digest-'));
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, '2026-11-01.jsonl'), NORMAL);
  writeFileSync(join(dir, '2026-11-02.jsonl'), BAD);
  writeFileSync(join(dir, '2026-11-03.jsonl'), '');
  app = createApp({ adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: dir });
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('GET /digest/:night', () => {
  it('renders the normal night, rows sorted by job, owner null as a dash', async () => {
    const res = await app.request('/digest/2026-11-01');
    const html = await res.text();
    expect(res.status).toBe(200);
    const a = html.indexOf('backup-a');
    const c = html.indexOf('cleanup-c');
    const s = html.indexOf('sync-b');
    expect(a).toBeGreaterThan(-1);
    expect(a).toBeLessThan(c);
    expect(c).toBeLessThan(s);
    expect(html).toContain('<td>—</td>'); // owner null
    expect(html).toContain('disk full');
    expect(html).toContain('2026-11-01T01:05:00+01:00');
    expect(html).not.toContain('could not be read');
    expect(html).not.toContain('nothing ran');
  });

  it('404s as plain text for a night with no file', async () => {
    const res = await app.request('/digest/2026-11-09');
    expect(res.status).toBe(404);
    expect(await res.text()).toBe('no such night');
  });

  it('says "nothing ran" for an empty night', async () => {
    const res = await app.request('/digest/2026-11-03');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('nothing ran');
  });

  it('keeps valid rows and reports one bad line', async () => {
    const res = await app.request('/digest/2026-11-02');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('1 line could not be read');
    expect(html).toContain('job-a');
    expect(html).toContain('job-c');
    expect(html).not.toContain('job-b');
  });
});

describe('GET /api/digest/:night', () => {
  it('returns the normal night as JSON, sorted by job, owner null kept', async () => {
    const res = await app.request('/api/digest/2026-11-01');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { night: string; rows: Array<Record<string, unknown>>; badLines: number };
    expect(body.night).toBe('2026-11-01');
    expect(body.badLines).toBe(0);
    expect(body.rows.map((r) => r.job)).toEqual(['backup-a', 'cleanup-c', 'sync-b']);
    expect(body.rows[0]).toEqual({
      job: 'backup-a',
      owner: null,
      runs: 2,
      retries: 1,
      fails: 1,
      lastStatus: 'fail',
      lastError: 'disk full',
      firstAt: '2026-11-01T01:05:00+01:00',
      lastAt: '2026-11-01T01:10:00+01:00',
    });
    expect(body.rows[2]?.owner).toBe('ana');
  });

  it('404s with a JSON error for a night with no file', async () => {
    const res = await app.request('/api/digest/2026-11-09');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'no such night' });
  });

  it('returns empty rows for the empty night', async () => {
    const res = await app.request('/api/digest/2026-11-03');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ night: '2026-11-03', rows: [], badLines: 0 });
  });

  it('counts the bad line and keeps the valid rows', async () => {
    const res = await app.request('/api/digest/2026-11-02');
    const body = (await res.json()) as { rows: Array<{ job: string }>; badLines: number };
    expect(res.status).toBe(200);
    expect(body.badLines).toBe(1);
    expect(body.rows.map((r) => r.job)).toEqual(['job-a', 'job-c']);
  });
});

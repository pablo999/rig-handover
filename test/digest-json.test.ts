import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { NightLog } from '../src/digest/types.js';

const config = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: 'runs' };

describe('digest JSON', () => {
  it('has the same jobs as the page, in the same order', async () => {
    const app = createApp(config);
    const res = await app.request('/api/digest/2026-10-28');
    expect(res.status).toBe(200);
    const log = (await res.json()) as NightLog;
    const html = await (await app.request('/digest/2026-10-28')).text();
    const positions = log.rows.map((r) => html.indexOf(r.job));
    expect(log.rows.length).toBeGreaterThan(0);
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it('404s as JSON for an unknown night', async () => {
    const res = await createApp(config).request('/api/digest/2020-01-01');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'no such night' });
  });
});

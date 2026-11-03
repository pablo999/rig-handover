import { Hono } from 'hono';
import { loadConfig, type RigConfig } from './config.js';
import { lane } from './lane.js';
import { readStatus } from './status.js';
import { readNight } from './digest/read.js';
import { DigestPage } from './views/digest.js';
import { Layout } from './views/layout.js';
import { StatusBoard } from './views/status.js';

export function createApp(config: RigConfig = loadConfig()) {
  const app = new Hono();

  app.get('/health', (c) => c.json({ ok: true, lane: lane().id }));

  app.get('/', (c) =>
    c.html(
      <Layout title="status" lane={lane()}>
        <StatusBoard status={readStatus(config)} />
      </Layout>,
    ),
  );

  // Unknown night (no file, or not YYYY-MM-DD): 404 as a plain-text body.
  app.get('/digest/:night', (c) => {
    const log = readNight(config.runsDir, c.req.param('night'));
    if (!log) return c.text('no such night', 404);
    return c.html(
      <Layout title={`digest ${log.night}`} lane={lane()}>
        <DigestPage log={log} />
      </Layout>,
    );
  });

  return app;
}

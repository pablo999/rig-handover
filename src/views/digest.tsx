import type { NightLog } from '../digest/types.js';

const dash = '—';

export function DigestPage({ log }: { log: NightLog }) {
  return (
    <>
      <h1>digest {log.night}</h1>
      {log.badLines > 0 && (
        <p class="warn">
          {log.badLines} {log.badLines === 1 ? 'line' : 'lines'} could not be read
        </p>
      )}
      {log.rows.length === 0 ? (
        <p class="mute">nothing ran</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>job</th>
              <th>owner</th>
              <th>runs</th>
              <th>retries</th>
              <th>last status</th>
              <th>last error</th>
              <th>first</th>
              <th>last</th>
            </tr>
          </thead>
          <tbody>
            {log.rows.map((r) => (
              <tr class={r.retries >= 3 || r.fails > 0 || r.lastStatus === 'fail' ? 'warn' : undefined}>
                <td>{r.job}</td>
                <td>{r.owner ?? dash}</td>
                <td>{r.runs}</td>
                <td>{r.retries}</td>
                <td>{r.lastStatus}</td>
                <td>{r.lastError ?? dash}</td>
                <td>{r.firstAt}</td>
                <td>{r.lastAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

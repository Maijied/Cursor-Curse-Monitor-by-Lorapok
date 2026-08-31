import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createServer } from 'node:http';
import { createDevApiMiddleware, resetDevStore } from '../../vite-dev-api.mjs';

function listen(handler: ReturnType<typeof createDevApiMiddleware>) {
  const server = createServer((req, res) => {
    handler(req, res, () => {
      res.statusCode = 404;
      res.end('not found');
    });
  });
  return new Promise<{ server: ReturnType<typeof createServer>; url: string }>((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      resolve({ server, url: `http://127.0.0.1:${port}` });
    });
  });
}

describe('subscribe API', () => {
  let server: ReturnType<typeof createServer>;
  let base: string;

  beforeEach(async () => {
    await resetDevStore();
    const started = await listen(createDevApiMiddleware());
    server = started.server;
    base = started.url;
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('accepts probe requests without consent', async () => {
    const res = await fetch(`${base}/api/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'probe@lorapok.tech', probe: true }),
    });
    const data = await res.json();
    expect(res.ok).toBe(true);
    expect(data.probed).toBe(true);
  });

  it('requires consent for real subscribe', async () => {
    const res = await fetch(`${base}/api/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'user@example.com' }),
    });
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error).toMatch(/consent/i);
  });

  it('records subscribe mail in the dev mailbox', async () => {
    const email = 'subscriber@example.com';
    const res = await fetch(`${base}/api/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, consent: true, source: 'website' }),
    });
    const data = await res.json();
    expect(res.ok).toBe(true);
    expect(data.ok).toBe(true);
    expect(data.emailed).toBe(true);

    const mailbox = await fetch(`${base}/api/mailbox`);
    const mailboxData = await mailbox.json();
    expect(mailbox.ok).toBe(true);
    expect(
      mailboxData.items.some(
        (row: { to: string; category: string }) => row.to === email && row.category === 'subscribe',
      ),
    ).toBe(true);

    const subscribers = await fetch(`${base}/api/subscribers`);
    const subscriberData = await subscribers.json();
    expect(subscribers.ok).toBe(true);
    expect(subscriberData.items.some((row: { email: string }) => row.email === email)).toBe(true);
  });
});

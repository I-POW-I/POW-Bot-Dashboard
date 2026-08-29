/**
 * Server-only helper for calling the bot's HTTP server (channels, roles,
 * welcome-preview). Never import this from a client component — it uses
 * BOT_API_TOKEN, which must never reach the browser.
 *
 * Requires BOT_HTTP_URL — the address the bot's HTTP server (index.js,
 * default port 8081) is reachable at from wherever the dashboard runs.
 * On Discloud this is whatever external address/port you've exposed for
 * the bot app — check the bot's Discloud app settings for its reachable
 * URL if you haven't set this yet.
 */

export function botHttpConfigured(): boolean {
  return Boolean(process.env.BOT_HTTP_URL && process.env.BOT_API_TOKEN);
}

export async function fetchFromBot(path: string): Promise<Response> {
  const base = process.env.BOT_HTTP_URL?.replace(/\/+$/, '');
  const token = process.env.BOT_API_TOKEN;
  if (!base || !token) {
    throw new Error('BOT_HTTP_URL or BOT_API_TOKEN not configured on the dashboard');
  }
  return fetch(`${base}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(10_000),
  });
}

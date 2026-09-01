/**
 * Enqueues a request for the bot to fulfil (channels, roles, a welcome-card
 * preview) and polls for the result. The bot has no public network address
 * on Discloud (TYPE=bot apps don't get one — confirmed against
 * docs.discloud.com), so everything goes through the same bot_commands
 * queue already used for restart/presence: the bot polls it every 15s, so
 * expect a few seconds of latency, not an instant response.
 */

const POLL_INTERVAL_MS = 1200;
const TIMEOUT_MS = 20_000;

export class BotRequestError extends Error {}
export class BotRequestTimeout extends BotRequestError {}

export async function requestFromBot<T = unknown>(
  guildId: string,
  command: 'fetch_channels' | 'fetch_roles' | 'render_preview',
  payload?: Record<string, unknown>
): Promise<T> {
  const enqueueRes = await fetch(`/api/bot/guilds/${guildId}/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ command, payload }),
  });
  const enqueued = await enqueueRes.json();
  if (!enqueueRes.ok) {
    throw new BotRequestError(enqueued.error || 'Failed to queue request');
  }

  const startedAt = Date.now();
  while (Date.now() - startedAt < TIMEOUT_MS) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    const res = await fetch(`/api/bot/commands/${enqueued.id}`);
    const body = await res.json();
    if (!res.ok) throw new BotRequestError(body.error || 'Failed to check request status');

    const cmd = body.command;
    if (cmd?.status === 'completed') return cmd.result as T;
    if (cmd?.status === 'failed') {
      throw new BotRequestError(cmd.error_message || 'Bot reported a failure');
    }
    // still 'pending' — keep polling
  }

  throw new BotRequestTimeout(
    'The bot took too long to respond — check it is online and DASHBOARD_URL/BOT_API_TOKEN are set correctly.'
  );
}

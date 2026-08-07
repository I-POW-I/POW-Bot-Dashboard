import { NextRequest, NextResponse } from 'next/server';
import { requireGuildAdmin } from '@/lib/server-auth';
import { supabaseServer } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: { guildId: string; webhookId: string } }
) {
  const authResult = await requireGuildAdmin(req, params.guildId);
  if (authResult instanceof NextResponse) return authResult;

  const sb = supabaseServer();
  const { data: webhook, error: fetchErr } = await sb
    .from('webhook_configs')
    .select('webhook_url, username, name, type, total_sent')
    .eq('id', params.webhookId)
    .eq('guild_id', params.guildId)
    .maybeSingle();

  if (fetchErr || !webhook) {
    return NextResponse.json({ error: 'Webhook not found' }, { status: 404 });
  }

  if (!webhook.webhook_url) {
    return NextResponse.json({ error: 'Webhook has no URL' }, { status: 400 });
  }

  let url: URL;
  try {
    url = new URL(webhook.webhook_url);
  } catch {
    return NextResponse.json({ error: 'Invalid webhook URL' }, { status: 400 });
  }

  if (url.hostname !== 'discord.com' && url.hostname !== 'discordapp.com') {
    return NextResponse.json({ error: 'Only Discord webhook URLs are allowed' }, { status: 400 });
  }

  try {
    const res = await fetch(url.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: webhook.username || 'POW Bot',
        content: `**Test fire** from webhook "${webhook.name}" (${webhook.type}).`,
      }),
    });
    if (!res.ok) {
      return NextResponse.json({ error: `Discord returned HTTP ${res.status}` }, { status: 502 });
    }
  } catch {
    return NextResponse.json({ error: 'Failed to reach Discord' }, { status: 502 });
  }

  await sb
    .from('webhook_configs')
    .update({
      last_triggered_at: new Date().toISOString(),
      total_sent: (webhook.total_sent || 0) + 1,
    })
    .eq('id', params.webhookId);

  return NextResponse.json({ ok: true });
}

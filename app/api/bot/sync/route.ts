import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// POST /api/bot/sync
// Called by the bot to push its current state to Supabase.
// Requires BOT_API_TOKEN for authentication.
// Body: { bot_status: {...}, guild_configs: [...], vc_sessions: [...] }
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const token = process.env.BOT_API_TOKEN;

  if (!token) {
    return NextResponse.json({ error: 'BOT_API_TOKEN not configured' }, { status: 500 });
  }

  if (authHeader !== `Bearer ${token}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const sb = supabaseServer();
  const results: Record<string, unknown> = {};

  // Sync bot_status
  if (body.bot_status) {
    const { error } = await sb
      .from('bot_status')
      .upsert({ id: 1, ...body.bot_status, updated_at: new Date().toISOString() });
    results.bot_status = error ? error.message : 'ok';
  }

  // Sync guild_configs
  if (Array.isArray(body.guild_configs)) {
    for (const cfg of body.guild_configs) {
      const { error } = await sb
        .from('guild_configs')
        .upsert(
          { ...cfg, updated_at: new Date().toISOString() },
          { onConflict: 'guild_id' }
        );
      if (error) {
        results[`guild_${cfg.guild_id}`] = error.message;
      }
    }
    results.guild_configs = 'ok';
  }

  // Sync vc_sessions
  if (Array.isArray(body.vc_sessions)) {
    for (const session of body.vc_sessions) {
      const { error } = await sb.from('vc_sessions').upsert(session);
      if (error) {
        results[`session_${session.id || session.user_discord_id}`] = error.message;
      }
    }
    results.vc_sessions = 'ok';
  }

  // Sync streamer_subscriptions
  if (Array.isArray(body.streamer_subscriptions)) {
    for (const sub of body.streamer_subscriptions) {
      const { error } = await sb
        .from('streamer_subscriptions')
        .upsert(sub, { onConflict: 'guild_id,platform,username' });
      if (error) {
        results[`streamer_${sub.guild_id}_${sub.platform}_${sub.username}`] = error.message;
      }
    }
    results.streamer_subscriptions = 'ok';
  }

  // Sync game_subscriptions
  if (Array.isArray(body.game_subscriptions)) {
    for (const sub of body.game_subscriptions) {
      const { error } = await sb
        .from('game_subscriptions')
        .upsert(sub, { onConflict: 'guild_id,app_id' });
      if (error) {
        results[`game_${sub.guild_id}_${sub.app_id}`] = error.message;
      }
    }
    results.game_subscriptions = 'ok';
  }

  return NextResponse.json({ ok: true, results });
}

// GET /api/bot/sync — health check for bot sync endpoint
export async function GET() {
  return NextResponse.json({ ok: true, endpoint: 'bot-sync' });
}

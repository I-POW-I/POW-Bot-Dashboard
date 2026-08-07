import { NextRequest, NextResponse } from 'next/server';
import { requireUser, requireGuildAdmin } from '@/lib/server-auth';
import { supabaseServer } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const token = process.env.BOT_API_TOKEN;
  if (token) {
    const authHeader = req.headers.get('authorization');
    if (authHeader === `Bearer ${token}`) {
      const { searchParams } = new URL(req.url);
      const status = searchParams.get('status') || 'pending';
      const limit = parseInt(searchParams.get('limit') || '50', 10);
      const sb = supabaseServer();
      const { data, error } = await sb
        .from('bot_commands')
        .select('*')
        .eq('status', status)
        .order('created_at', { ascending: true })
        .limit(limit);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ commands: data || [] });
    }
  }

  const authResult = await requireUser(req);
  if (authResult instanceof NextResponse) return authResult;

  const sb = supabaseServer();
  const { data, error } = await sb
    .from('bot_commands')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ commands: data || [] });
}

export async function POST(req: NextRequest) {
  const authResult = await requireUser(req);
  if (authResult instanceof NextResponse) return authResult;

  const body = await req.json().catch(() => ({}));
  const { guild_id, command, payload } = body;

  if (!guild_id || !command) {
    return NextResponse.json(
      { error: 'guild_id and command are required' },
      { status: 400 }
    );
  }

  if (typeof authResult !== 'object' || 'error' in authResult) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const guildCheck = await requireGuildAdmin(req, guild_id);
  if (guildCheck instanceof NextResponse) return guildCheck;

  const allowedCommands = ['restart', 'presence', 'sync', 'refresh_status'];
  if (!allowedCommands.includes(command)) {
    return NextResponse.json(
      { error: `Unknown command: ${command}` },
      { status: 400 }
    );
  }

  const sb = supabaseServer();
  const { data, error } = await sb
    .from('bot_commands')
    .insert({
      guild_id,
      command,
      payload: payload || {},
      status: 'pending',
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, command: data });
}

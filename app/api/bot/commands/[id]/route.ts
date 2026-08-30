import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import { requireBotToken } from '@/lib/bot-auth';
import { requireGuildMember } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

// GET /api/bot/commands/[id]
// Called by the DASHBOARD (a logged-in user, not the bot) to poll for the
// result of a command it just enqueued — e.g. a channels/roles fetch or a
// welcome-card preview render. Requires membership in the command's guild.
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = parseInt(params.id, 10);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: 'Invalid command id' }, { status: 400 });
  }

  const sb = supabaseServer();
  const { data, error } = await sb
    .from('bot_commands')
    .select('id, guild_id, command, status, result, error_message')
    .eq('id', id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message || 'Not found' }, { status: 404 });
  }

  // 'global' is used for owner-level commands (restart/presence) that
  // aren't tied to a specific guild — those aren't polled by this route in
  // practice, but guard it anyway rather than assume.
  if (data.guild_id !== 'global') {
    const authResult = await requireGuildMember(req, data.guild_id);
    if (authResult instanceof NextResponse) return authResult;
  }

  return NextResponse.json({ command: data });
}

// PATCH /api/bot/commands/[id]
// Called by the bot to mark a command as processed (completed or failed),
// optionally carrying a result payload back (channels/roles lists, a
// rendered preview image, etc.) — the bot has no public network address on
// Discloud, so this queue is the only channel data can travel back through.
// Requires BOT_API_TOKEN for authentication.
// Body: { status: 'completed' | 'failed', error_message?: string, result?: object }
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const authError = requireBotToken(req);
  if (authError) return authError;

  const id = parseInt(params.id, 10);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: 'Invalid command id' }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const { status, error_message, result } = body;

  if (!status || !['completed', 'failed', 'processing'].includes(status)) {
    return NextResponse.json(
      { error: 'status must be completed, failed, or processing' },
      { status: 400 }
    );
  }

  const sb = supabaseServer();
  const updates: Record<string, unknown> = {
    status,
    processed_at: status === 'completed' || status === 'failed' ? new Date().toISOString() : null,
  };
  if (error_message) updates.error_message = String(error_message).slice(0, 2000);
  if (result !== undefined) updates.result = result;

  const { data, error } = await sb
    .from('bot_commands')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, command: data });
}

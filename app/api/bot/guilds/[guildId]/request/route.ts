import { NextRequest, NextResponse } from 'next/server';
import { requireGuildMember } from '@/lib/server-auth';
import { supabaseServer } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const ALLOWED_COMMANDS = ['fetch_channels', 'fetch_roles', 'render_preview'];

// POST /api/bot/guilds/[guildId]/request
// Enqueues a bot_commands row for the bot to pick up on its next 15s poll
// (src/dashboardSync.js) and write a result back into. Used for anything
// that needs live data FROM the bot — channels, roles, a welcome-card
// preview render — since the bot has no public network address to call
// directly (Discloud TYPE=bot apps don't get one).
// Body: { command: 'fetch_channels'|'fetch_roles'|'render_preview', payload?: object }
// Returns: { id } — poll GET /api/bot/commands/[id] with that id for the result.
export async function POST(
  req: NextRequest,
  { params }: { params: { guildId: string } }
) {
  const authResult = await requireGuildMember(req, params.guildId);
  if (authResult instanceof NextResponse) return authResult;

  const body = await req.json().catch(() => ({}));
  const { command, payload } = body;

  if (!ALLOWED_COMMANDS.includes(command)) {
    return NextResponse.json(
      { error: `command must be one of: ${ALLOWED_COMMANDS.join(', ')}` },
      { status: 400 }
    );
  }

  // render_preview needs to know who's asking, so the bot can use THEIR
  // real Discord identity (nickname/username/avatar) for the preview.
  const finalPayload =
    command === 'render_preview'
      ? { ...payload, discordId: authResult.discordId }
      : payload || {};

  const sb = supabaseServer();
  const { data, error } = await sb
    .from('bot_commands')
    .insert({
      guild_id: params.guildId,
      command,
      payload: finalPayload,
      status: 'pending',
    })
    .select('id')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ id: data.id });
}

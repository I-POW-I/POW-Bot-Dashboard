import { NextRequest, NextResponse } from 'next/server';
import { requireGuildAdmin } from '@/lib/server-auth';
import { supabaseServer } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function DELETE(
  req: NextRequest,
  { params }: { params: { guildId: string; id: string } }
) {
  const authResult = await requireGuildAdmin(req, params.guildId);
  if (authResult instanceof NextResponse) return authResult;

  const sb = supabaseServer();
  const { error } = await sb
    .from('streamer_subscriptions')
    .delete()
    .eq('id', Number(params.id))
    .eq('guild_id', params.guildId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

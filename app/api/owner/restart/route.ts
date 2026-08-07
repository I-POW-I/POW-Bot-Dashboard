import { NextRequest, NextResponse } from 'next/server';
import { requireOwner } from '@/lib/server-auth';
import { supabaseServer } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const authResult = await requireOwner(req);
  if (authResult instanceof NextResponse) return authResult;

  const sb = supabaseServer();
  const { error } = await sb
    .from('bot_status')
    .update({
      online: false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', 1);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  try {
    await sb.from('bot_commands').insert({
      guild_id: 'global',
      command: 'restart',
      payload: {},
      status: 'pending',
    });
  } catch {
    // Non-fatal
  }

  return NextResponse.json({ ok: true, message: 'Restart triggered' });
}

import { NextRequest, NextResponse } from 'next/server';
import { requireOwner } from '@/lib/server-auth';
import { supabaseServer } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const authResult = await requireOwner(req);
  if (authResult instanceof NextResponse) return authResult;

  const body = await req.json().catch(() => ({}));
  const { type, text } = body as { type?: string; text?: string };
  if (!type || !text) {
    return NextResponse.json({ error: 'type and text required' }, { status: 400 });
  }

  const sb = supabaseServer();
  const { error } = await sb
    .from('bot_status')
    .update({
      presence_type: type,
      presence_activity: text,
      updated_at: new Date().toISOString(),
    })
    .eq('id', 1);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  try {
    await sb.from('bot_commands').insert({
      guild_id: 'global',
      command: 'presence',
      payload: { type, text },
      status: 'pending',
    });
  } catch {
    // Non-fatal
  }

  return NextResponse.json({ ok: true });
}

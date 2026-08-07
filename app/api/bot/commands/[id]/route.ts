import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// PATCH /api/bot/commands/[id]
// Called by the bot to mark a command as processed (completed or failed).
// Requires BOT_API_TOKEN for authentication.
// Body: { status: 'completed' | 'failed', error_message?: string }
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const authHeader = req.headers.get('authorization');
  const token = process.env.BOT_API_TOKEN;

  if (!token) {
    return NextResponse.json({ error: 'BOT_API_TOKEN not configured' }, { status: 500 });
  }

  if (authHeader !== `Bearer ${token}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { status, error_message } = body;

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
  if (error_message) updates.error_message = error_message;

  const { data, error } = await sb
    .from('bot_commands')
    .update(updates)
    .eq('id', parseInt(params.id, 10))
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, command: data });
}

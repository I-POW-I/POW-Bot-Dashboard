import { NextRequest, NextResponse } from 'next/server';
import { requireGuildMember } from '@/lib/server-auth';
import { fetchFromBot, botHttpConfigured } from '@/lib/bot-http';

export const dynamic = 'force-dynamic';

// GET /api/bot/guilds/[guildId]/channels
// Proxies to the bot's live channel list so the dashboard shows real
// channels instead of placeholder data. Requires a logged-in member of
// the guild (not admin-only — everyone should be able to see the list,
// same as the actual /welcome setup Discord command).
export async function GET(
  req: NextRequest,
  { params }: { params: { guildId: string } }
) {
  const authResult = await requireGuildMember(req, params.guildId);
  if (authResult instanceof NextResponse) return authResult;

  if (!botHttpConfigured()) {
    return NextResponse.json(
      { error: 'Bot HTTP connection not configured on the dashboard (BOT_HTTP_URL / BOT_API_TOKEN)', channels: [] },
      { status: 200 } // 200 with empty list — UI can show "bot unreachable" without erroring the whole page
    );
  }

  try {
    const res = await fetchFromBot(`/guilds/${params.guildId}/channels`);
    if (!res.ok) {
      return NextResponse.json({ error: `Bot returned ${res.status}`, channels: [] }, { status: 200 });
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Bot unreachable', channels: [] },
      { status: 200 }
    );
  }
}

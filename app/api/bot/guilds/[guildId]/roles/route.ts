import { NextRequest, NextResponse } from 'next/server';
import { requireGuildMember } from '@/lib/server-auth';
import { fetchFromBot, botHttpConfigured } from '@/lib/bot-http';

export const dynamic = 'force-dynamic';

// GET /api/bot/guilds/[guildId]/roles
// Proxies to the bot's live role list. Same reasoning as the channels
// route — member access is enough, matches the Discord command's own
// permission level.
export async function GET(
  req: NextRequest,
  { params }: { params: { guildId: string } }
) {
  const authResult = await requireGuildMember(req, params.guildId);
  if (authResult instanceof NextResponse) return authResult;

  if (!botHttpConfigured()) {
    return NextResponse.json(
      { error: 'Bot HTTP connection not configured on the dashboard (BOT_HTTP_URL / BOT_API_TOKEN)', roles: [] },
      { status: 200 }
    );
  }

  try {
    const res = await fetchFromBot(`/guilds/${params.guildId}/roles`);
    if (!res.ok) {
      return NextResponse.json({ error: `Bot returned ${res.status}`, roles: [] }, { status: 200 });
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Bot unreachable', roles: [] },
      { status: 200 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { requireGuildMember } from '@/lib/server-auth';
import { fetchFromBot, botHttpConfigured } from '@/lib/bot-http';

export const dynamic = 'force-dynamic';

// GET /api/bot/guilds/[guildId]/welcome-preview?type=&nameMode=&accentColor=&avatarPosition=&textAlign=
// Streams back the bot's actual generateCard() output — the same function
// real join/leave events use — rendered with the logged-in user's own
// Discord identity, so the preview is pixel-accurate rather than a
// hand-built approximation.
export async function GET(
  req: NextRequest,
  { params }: { params: { guildId: string } }
) {
  const authResult = await requireGuildMember(req, params.guildId);
  if (authResult instanceof NextResponse) return authResult;

  if (!botHttpConfigured()) {
    return NextResponse.json(
      { error: 'Bot HTTP connection not configured on the dashboard (BOT_HTTP_URL / BOT_API_TOKEN)' },
      { status: 503 }
    );
  }

  const { searchParams } = new URL(req.url);
  const qs = new URLSearchParams({
    discordId: authResult.discordId,
    type: searchParams.get('type') === 'leave' ? 'leave' : 'welcome',
    nameMode: searchParams.get('nameMode') || '',
    accentColor: searchParams.get('accentColor') || '',
    avatarPosition: searchParams.get('avatarPosition') || '',
    textAlign: searchParams.get('textAlign') || '',
  });

  try {
    const res = await fetchFromBot(`/guilds/${params.guildId}/welcome-preview?${qs.toString()}`);
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: `Bot returned ${res.status}` }));
      return NextResponse.json(body, { status: res.status });
    }
    const buffer = await res.arrayBuffer();
    return new NextResponse(buffer, {
      headers: { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Bot unreachable' },
      { status: 502 }
    );
  }
}

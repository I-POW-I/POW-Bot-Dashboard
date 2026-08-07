import { NextResponse } from 'next/server';
import { fetchBotStatus } from '@/lib/data';

export const dynamic = 'force-dynamic';

export async function GET() {
  const status = await fetchBotStatus();
  return NextResponse.json({
    ok: true,
    online: status?.online ?? false,
    ping_ms: status?.ping_ms ?? null,
    active_connections: status?.active_connections ?? 0,
    total_guilds: status?.total_guilds ?? 0,
    updated_at: status?.updated_at ?? null,
  });
}

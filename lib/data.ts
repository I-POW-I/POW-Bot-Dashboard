import { supabase } from '@/lib/supabase';
import type {
  AuditLogEntry,
  BotStatus,
  GameSubscription,
  GuildConfig,
  StreamerSubscription,
  VcSession,
} from '@/types';

export async function fetchGuildConfig(guildId: string): Promise<GuildConfig | null> {
  const { data, error } = await supabase
    .from('guild_configs')
    .select('*')
    .eq('guild_id', guildId)
    .maybeSingle();
  if (error) {
    console.warn('[data] fetchGuildConfig', error.message);
    return null;
  }
  return data as GuildConfig | null;
}

export async function fetchBotStatus(): Promise<BotStatus | null> {
  const { data, error } = await supabase
    .from('bot_status')
    .select('*')
    .eq('id', 1)
    .maybeSingle();
  if (error) {
    console.warn('[data] fetchBotStatus', error.message);
    return null;
  }
  return data as BotStatus | null;
}

export async function fetchAuditLog(
  guildId: string,
  limit = 10
): Promise<AuditLogEntry[]> {
  const { data, error } = await supabase
    .from('audit_log')
    .select('*')
    .eq('guild_id', guildId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) {
    console.warn('[data] fetchAuditLog', error.message);
    return [];
  }
  return (data || []) as AuditLogEntry[];
}

export async function fetchStreamers(
  guildId: string
): Promise<StreamerSubscription[]> {
  const { data, error } = await supabase
    .from('streamer_subscriptions')
    .select('*')
    .eq('guild_id', guildId)
    .order('created_at', { ascending: false });
  if (error) {
    console.warn('[data] fetchStreamers', error.message);
    return [];
  }
  return (data || []) as StreamerSubscription[];
}

export async function fetchGameAlerts(
  guildId: string
): Promise<GameSubscription[]> {
  const { data, error } = await supabase
    .from('game_subscriptions')
    .select('*')
    .eq('guild_id', guildId)
    .order('created_at', { ascending: false });
  if (error) {
    console.warn('[data] fetchGameAlerts', error.message);
    return [];
  }
  return (data || []) as GameSubscription[];
}

export async function fetchVcSessions(
  guildId: string,
  limit = 500
): Promise<VcSession[]> {
  const { data, error } = await supabase
    .from('vc_sessions')
    .select('*')
    .eq('guild_id', guildId)
    .order('joined_at', { ascending: false })
    .limit(limit);
  if (error) {
    console.warn('[data] fetchVcSessions', error.message);
    return [];
  }
  return (data || []) as VcSession[];
}

export async function insertAuditLog(entry: Omit<AuditLogEntry, 'id' | 'created_at'>): Promise<void> {
  await supabase.from('audit_log').insert(entry);
}

export function formatMs(ms: number | null | undefined): string {
  if (!ms || ms <= 0) return '0m';
  const totalS = Math.floor(ms / 1000);
  const d = Math.floor(totalS / 86400);
  const h = Math.floor((totalS % 86400) / 3600);
  const m = Math.floor((totalS % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function formatUptime(ms: number | null | undefined): string {
  if (!ms || ms <= 0) return '0s';
  const totalS = Math.floor(ms / 1000);
  const d = Math.floor(totalS / 86400);
  const h = Math.floor((totalS % 86400) / 3600);
  const m = Math.floor((totalS % 3600) / 60);
  const s = totalS % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30);
  return `${mo}mo ago`;
}

export type GlobalRole = 'owner' | 'admin' | 'moderator' | 'viewer';
export type GuildRole = 'owner' | 'admin' | 'moderator' | 'viewer';
export type LogChannelType = 'voice' | 'messages' | 'members' | 'modlog';
export type StreamerPlatform = 'kick' | 'twitch' | 'youtube';
export type AnnouncementStatus = 'draft' | 'sent' | 'failed';
export type BlacklistTargetType = 'guild' | 'user';
export type AuditCategory =
  | 'voice'
  | 'logging'
  | 'streamers'
  | 'verification'
  | 'welcome'
  | 'system'
  | 'announcement'
  | 'blacklist'
  | 'presence';

export interface DashboardUser {
  id: string;
  user_id: string;
  discord_id: string;
  username: string;
  global_name: string | null;
  avatar_url: string | null;
  global_role: GlobalRole;
  created_at: string;
  last_seen_at: string;
}

export interface GuildMember {
  id: string;
  user_id: string;
  guild_id: string;
  role: GuildRole;
  created_at: string;
}

export interface LogChannels {
  voice?: string;
  messages?: string;
  members?: string;
  modlog?: string;
}

export interface WelcomeCardConfig {
  nameMode?: 'nickname' | 'username';
  accentColor?: string | null;
  avatarPosition?: 'left' | 'center' | 'right';
  textAlign?: 'left' | 'center' | 'right';
}

export interface GuildConfig {
  guild_id: string;
  guild_name: string | null;
  guild_icon: string | null;
  log_channels: LogChannels;
  panel_channel_id: string | null;
  panel_message_id: string | null;
  welcome_channel_id: string | null;
  leave_channel_id: string | null;
  welcome_card_config: WelcomeCardConfig;
  verify_role_id: string | null;
  verify_channel_id: string | null;
  verify_message_id: string | null;
  bot_control_role_id: string | null;
  target_voice_channel_id: string | null;
  last_channel_id: string | null;
  joined_at: string | null;
  reconnect_count: number;
  updated_at: string;
}

export interface VcSession {
  id: number;
  user_discord_id: string;
  guild_id: string;
  channel_id: string;
  channel_name: string | null;
  username: string | null;
  avatar_url: string | null;
  joined_at: string;
  left_at: string | null;
  duration_ms: number | null;
}

export interface StreamerSubscription {
  id: number;
  guild_id: string;
  platform: StreamerPlatform;
  username: string;
  display_name: string | null;
  discord_channel_id: string;
  role_id: string | null;
  is_live: boolean;
  last_message_id: string | null;
  last_went_live: string | null;
  last_stream_title: string | null;
  last_updated_at: string | null;
  created_at: string;
}

export interface GameSubscription {
  id: number;
  guild_id: string;
  app_id: string;
  game_name: string | null;
  channel_id: string;
  role_id: string | null;
  last_post_id: string | null;
  color: number | null;
  created_at: string;
}

export interface AuditLogEntry {
  id: number;
  guild_id: string;
  actor_discord_id: string | null;
  actor_username: string | null;
  action: string;
  category: AuditCategory;
  details: Record<string, unknown>;
  created_at: string;
}

export interface Announcement {
  id: string;
  user_id: string;
  title: string;
  body: string | null;
  color: number;
  target_guild_ids: string[];
  status: AnnouncementStatus;
  sent_at: string | null;
  created_at: string;
}

export interface BlacklistEntry {
  id: number;
  target_type: BlacklistTargetType;
  target_id: string;
  reason: string | null;
  created_at: string;
}

export interface DashboardPresence {
  type: 'Playing' | 'Watching' | 'Listening' | 'Custom';
  text: string;
}

export interface BotStatus {
  id: number;
  online: boolean;
  ping_ms: number;
  process_uptime_ms: number;
  memory_mb: number;
  active_connections: number;
  total_guilds: number;
  total_members: number;
  presence_activity: string | null;
  presence_type: string | null;
  presence_mode: 'rotate' | 'fixed';
  presence_list: DashboardPresence[];
  updated_at: string;
  /** Derived client-side by fetchBotStatus() — true if no heartbeat in >2 min. */
  stale?: boolean;
}

export interface DiscordGuild {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  permissions: string;
}

export interface DiscordUser {
  id: string;
  username: string;
  global_name: string | null;
  avatar: string | null;
  discriminator: string;
}

export interface SessionUser {
  discordId: string;
  username: string;
  globalName: string | null;
  avatarUrl: string | null;
  globalRole: GlobalRole;
  guilds: { guildId: string; role: GuildRole }[];
  appRole: AppRole;
  appUserId: string | null;
}

// ── Enhanced dashboard types ────────────────────────────────────────────────

export type AppRole = 'super_admin' | 'admin' | 'editor' | 'viewer';
export type AppUserStatus = 'active' | 'suspended' | 'pending';
export type NotificationSeverity = 'info' | 'warning' | 'error' | 'success';
export type NotificationCategory =
  | 'general'
  | 'voice'
  | 'streamer'
  | 'game'
  | 'system'
  | 'security'
  | 'user'
  | 'announcement'
  | 'audit';

export interface AppUser {
  id: string;
  user_id: string | null;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: AppRole;
  status: AppUserStatus;
  last_active_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  severity: NotificationSeverity;
  category: NotificationCategory;
  title: string;
  body: string | null;
  action_label: string | null;
  action_url: string | null;
  metadata: Record<string, unknown>;
  read: boolean;
  created_at: string;
}

export interface Invitation {
  id: string;
  email: string;
  role: AppRole;
  invited_by: string | null;
  status: 'pending' | 'accepted' | 'revoked';
  expires_at: string;
  created_at: string;
}

export interface AppSettings {
  user_id: string;
  general: {
    app_name: string;
    timezone: string;
    locale: string;
  };
  security: {
    session_timeout_minutes: number;
    two_factor: boolean;
    password_min_length: number;
    password_require_special: boolean;
  };
  notification_prefs: {
    email: boolean;
    in_app: boolean;
    webhook: boolean;
    webhook_url: string;
    channels: Record<NotificationCategory, boolean>;
  };
  appearance: {
    theme: 'light' | 'dark' | 'system';
    accent: string;
  };
  integrations: Record<string, boolean>;
  permissions_matrix: Record<AppRole, Record<string, boolean>>;
  updated_at: string;
}

export type DashboardFeature =
  | 'voice'
  | 'logging'
  | 'welcome'
  | 'streamers'
  | 'games'
  | 'leaderboard'
  | 'audit'
  | 'users'
  | 'settings'
  | 'owner'
  | 'automod'
  | 'commands'
  | 'reaction-roles'
  | 'tickets'
  | 'webhooks';

// ── Bot management feature types ────────────────────────────────────────────

export type AutomodAction = 'warn' | 'delete' | 'mute' | 'kick' | 'ban';
export type AutomodRuleType =
  | 'spam'
  | 'word_filter'
  | 'link_block'
  | 'raid_protection'
  | 'caps_lock'
  | 'mention_spam'
  | 'invite_block';

export interface AutomodRule {
  id: string;
  guild_id: string;
  rule_type: AutomodRuleType;
  enabled: boolean;
  config: Record<string, unknown>;
  action: AutomodAction;
  action_duration_seconds: number | null;
  exempt_roles: string[] | null;
  exempt_channels: string[] | null;
  created_at: string;
  updated_at: string;
}

export type CommandResponseType = 'text' | 'embed' | 'random';

export interface CustomCommand {
  id: string;
  guild_id: string;
  name: string;
  description: string | null;
  response_type: CommandResponseType;
  response_content: string;
  required_role_id: string | null;
  enabled: boolean;
  cooldown_seconds: number;
  usage_count: number;
  created_by: string | null;
  created_at: string;
}

export type ReactionRoleMode = 'single' | 'multiple' | 'verify';

export interface ReactionRoleGroup {
  id: string;
  guild_id: string;
  channel_id: string;
  message_id: string | null;
  title: string;
  description: string | null;
  mode: ReactionRoleMode;
  max_roles: number | null;
  enabled: boolean;
  created_at: string;
}

export interface ReactionRole {
  id: string;
  group_id: string;
  emoji: string;
  role_id: string;
  label: string | null;
  description: string | null;
  position: number;
}

export type TicketButtonStyle = 'primary' | 'secondary' | 'success' | 'danger';

export interface TicketConfig {
  id: string;
  guild_id: string;
  enabled: boolean;
  category_id: string | null;
  support_role_id: string | null;
  log_channel_id: string | null;
  welcome_message: string | null;
  max_open_tickets: number;
  auto_close_hours: number;
  claim_button: boolean;
  close_button: boolean;
  transcript_on_close: boolean;
  button_label: string;
  button_emoji: string | null;
  button_style: TicketButtonStyle;
}

export type WebhookType = 'custom' | 'twitch' | 'youtube' | 'github' | 'rss';

export interface WebhookConfig {
  id: string;
  guild_id: string;
  name: string;
  webhook_url: string;
  channel_id: string | null;
  avatar_url: string | null;
  username: string | null;
  type: WebhookType;
  trigger_config: Record<string, unknown> | null;
  enabled: boolean;
  last_triggered_at: string | null;
  total_sent: number;
  created_at: string;
}

export const APP_ROLE_LABELS: Record<AppRole, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  editor: 'Editor',
  viewer: 'Viewer',
};

export const APP_ROLE_DESCRIPTIONS: Record<AppRole, string> = {
  super_admin: 'Full access to everything, including billing and danger zone.',
  admin: 'Manage users and settings. No billing or destructive actions.',
  editor: 'Content and configuration changes only.',
  viewer: 'Read-only access to all dashboard pages.',
};

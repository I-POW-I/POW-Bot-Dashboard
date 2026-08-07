'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  ChevronDown,
  Filter,
  Link2,
  MessageSquareOff,
  Plus,
  Save,
  ShieldAlert,
  Slash,
  Swords,
  Trash2,
  Users,
  Volume2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/components/providers/auth-provider';
import { supabase } from '@/lib/supabase';
import { insertAuditLog } from '@/lib/data';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────

type AutomodAction = 'warn' | 'delete' | 'mute' | 'kick' | 'ban';
type RuleType =
  | 'spam'
  | 'word_filter'
  | 'link_block'
  | 'raid_protection'
  | 'caps_lock'
  | 'mention_spam'
  | 'invite_block';

interface AutomodRule {
  id: string;
  guild_id: string;
  rule_type: RuleType;
  enabled: boolean;
  config: Record<string, unknown>;
  action: AutomodAction;
  action_duration_seconds: number | null;
  exempt_roles: string[];
  exempt_channels: string[];
  created_at: string;
  updated_at: string;
}

// ── Rule metadata ─────────────────────────────────────────────────────────────

const RULE_META: Record<RuleType, {
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  defaultConfig: Record<string, unknown>;
}> = {
  spam: {
    label: 'Spam Detection',
    description: 'Detect and action users sending too many messages too quickly.',
    icon: MessageSquareOff,
    color: 'text-warning bg-warning/10',
    defaultConfig: { max_messages: 5, per_seconds: 5, threshold_count: 3 },
  },
  word_filter: {
    label: 'Word Filter',
    description: 'Block messages containing banned words or phrases.',
    icon: Filter,
    color: 'text-destructive bg-destructive/10',
    defaultConfig: { words: [], use_regex: false, wildcard: true },
  },
  link_block: {
    label: 'Link Blocking',
    description: 'Block links, allow-list trusted domains, or require certain roles to post links.',
    icon: Link2,
    color: 'text-chart-3 bg-chart-3/10',
    defaultConfig: { mode: 'all', allowlist: [], block_invites: true },
  },
  raid_protection: {
    label: 'Raid Protection',
    description: 'Detect mass joins and auto-lockdown the server when a raid threshold is hit.',
    icon: ShieldAlert,
    color: 'text-destructive bg-destructive/10',
    defaultConfig: { join_threshold: 10, per_seconds: 30, lockdown_minutes: 10 },
  },
  caps_lock: {
    label: 'Caps Lock Filter',
    description: 'Delete messages that are excessively in capitals.',
    icon: Slash,
    color: 'text-chart-4 bg-chart-4/10',
    defaultConfig: { min_length: 10, caps_percent: 70 },
  },
  mention_spam: {
    label: 'Mention Spam',
    description: 'Limit how many users someone can mention in a single message.',
    icon: Users,
    color: 'text-primary bg-primary/10',
    defaultConfig: { max_mentions: 5, include_everyone: true },
  },
  invite_block: {
    label: 'Invite Block',
    description: 'Block Discord invite links from being posted in the server.',
    icon: Ban,
    color: 'text-destructive bg-destructive/10',
    defaultConfig: { allow_own_server: true, log_attempts: true },
  },
};

const ACTIONS: { value: AutomodAction; label: string; color: string }[] = [
  { value: 'warn', label: 'Warn user (DM)', color: 'text-chart-3' },
  { value: 'delete', label: 'Delete message', color: 'text-warning' },
  { value: 'mute', label: 'Timeout user', color: 'text-chart-4' },
  { value: 'kick', label: 'Kick user', color: 'text-destructive' },
  { value: 'ban', label: 'Ban user', color: 'text-destructive' },
];

const DEMO_ROLES = [
  { id: '9182736451029392', name: 'Admin' },
  { id: '9182736451029394', name: 'Moderator' },
  { id: '9182736451029396', name: 'Member' },
];

const DEMO_CHANNELS = [
  { id: '9182736451029388', name: 'general' },
  { id: '9182736451029389', name: 'bot-commands' },
  { id: '9182736451029390', name: 'welcome' },
];

// ── Rule card ─────────────────────────────────────────────────────────────────

function RuleCard({
  rule,
  onToggle,
  onEdit,
  onDelete,
}: {
  rule: AutomodRule;
  onToggle: (id: string, enabled: boolean) => void;
  onEdit: (rule: AutomodRule) => void;
  onDelete: (rule: AutomodRule) => void;
}) {
  const meta = RULE_META[rule.rule_type];
  const Icon = meta.icon;
  const action = ACTIONS.find((a) => a.value === rule.action);

  return (
    <div className={cn(
      'group rounded-xl border p-4 transition-all',
      rule.enabled
        ? 'border-border/60 bg-card/40'
        : 'border-border/30 bg-muted/10 opacity-60'
    )}>
      <div className="flex items-start gap-4">
        <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', meta.color)}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-foreground">{meta.label}</span>
            {rule.enabled ? (
              <Badge variant="outline" className="border-success/30 bg-success/10 text-success text-[10px]">Active</Badge>
            ) : (
              <Badge variant="outline" className="text-muted-foreground text-[10px]">Disabled</Badge>
            )}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">{meta.description}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={cn('text-[10px]', action?.color)}>
              Action: {action?.label}
            </Badge>
            {rule.action === 'mute' && rule.action_duration_seconds && (
              <Badge variant="outline" className="text-[10px] text-muted-foreground">
                {Math.round(rule.action_duration_seconds / 60)}m timeout
              </Badge>
            )}
            {rule.exempt_roles.length > 0 && (
              <Badge variant="outline" className="text-[10px] text-muted-foreground">
                {rule.exempt_roles.length} exempt role{rule.exempt_roles.length !== 1 ? 's' : ''}
              </Badge>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Switch
            checked={rule.enabled}
            onCheckedChange={(v) => onToggle(rule.id, v)}
          />
          <Button variant="ghost" size="sm" onClick={() => onEdit(rule)}>Edit</Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            onClick={() => onDelete(rule)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Config editors per rule type ──────────────────────────────────────────────

function SpamConfig({ config, onChange }: { config: Record<string, unknown>; onChange: (c: Record<string, unknown>) => void }) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <div className="space-y-1.5">
        <Label className="text-xs">Max messages</Label>
        <Input type="number" value={String(config.max_messages ?? 5)} onChange={(e) => onChange({ ...config, max_messages: Number(e.target.value) })} />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Per (seconds)</Label>
        <Input type="number" value={String(config.per_seconds ?? 5)} onChange={(e) => onChange({ ...config, per_seconds: Number(e.target.value) })} />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Strike threshold</Label>
        <Input type="number" value={String(config.threshold_count ?? 3)} onChange={(e) => onChange({ ...config, threshold_count: Number(e.target.value) })} />
        <p className="text-[10px] text-muted-foreground">Action triggers after this many violations</p>
      </div>
    </div>
  );
}

function WordFilterConfig({ config, onChange }: { config: Record<string, unknown>; onChange: (c: Record<string, unknown>) => void }) {
  const words = (config.words as string[] | undefined) ?? [];
  const [input, setInput] = useState('');
  const add = () => {
    const trimmed = input.trim().toLowerCase();
    if (trimmed && !words.includes(trimmed)) {
      onChange({ ...config, words: [...words, trimmed] });
    }
    setInput('');
  };
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          placeholder="Add word or phrase…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())}
          className="font-mono text-sm"
        />
        <Button type="button" variant="outline" onClick={add}>Add</Button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {words.map((w) => (
          <Badge key={w} variant="outline" className="gap-1 font-mono text-xs">
            {w}
            <button onClick={() => onChange({ ...config, words: words.filter((x) => x !== w) })} className="ml-1 opacity-60 hover:opacity-100">×</button>
          </Badge>
        ))}
        {words.length === 0 && <p className="text-xs text-muted-foreground">No words added.</p>}
      </div>
      <div className="flex items-center gap-3">
        <Switch checked={Boolean(config.wildcard)} onCheckedChange={(v) => onChange({ ...config, wildcard: v })} />
        <Label className="text-xs">Wildcard matching (catches "badword123")</Label>
      </div>
    </div>
  );
}

function CapsConfig({ config, onChange }: { config: Record<string, unknown>; onChange: (c: Record<string, unknown>) => void }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label className="text-xs">Minimum message length (chars)</Label>
        <Input type="number" value={String(config.min_length ?? 10)} onChange={(e) => onChange({ ...config, min_length: Number(e.target.value) })} />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Caps percentage to trigger (%)</Label>
        <Input type="number" min="0" max="100" value={String(config.caps_percent ?? 70)} onChange={(e) => onChange({ ...config, caps_percent: Number(e.target.value) })} />
      </div>
    </div>
  );
}

function MentionConfig({ config, onChange }: { config: Record<string, unknown>; onChange: (c: Record<string, unknown>) => void }) {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs">Max mentions per message</Label>
        <Input type="number" value={String(config.max_mentions ?? 5)} onChange={(e) => onChange({ ...config, max_mentions: Number(e.target.value) })} className="w-32" />
      </div>
      <div className="flex items-center gap-3">
        <Switch checked={Boolean(config.include_everyone)} onCheckedChange={(v) => onChange({ ...config, include_everyone: v })} />
        <Label className="text-xs">Count @everyone and @here as mass mentions</Label>
      </div>
    </div>
  );
}

function RaidConfig({ config, onChange }: { config: Record<string, unknown>; onChange: (c: Record<string, unknown>) => void }) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <div className="space-y-1.5">
        <Label className="text-xs">Join threshold</Label>
        <Input type="number" value={String(config.join_threshold ?? 10)} onChange={(e) => onChange({ ...config, join_threshold: Number(e.target.value) })} />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Within (seconds)</Label>
        <Input type="number" value={String(config.per_seconds ?? 30)} onChange={(e) => onChange({ ...config, per_seconds: Number(e.target.value) })} />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Lockdown duration (minutes)</Label>
        <Input type="number" value={String(config.lockdown_minutes ?? 10)} onChange={(e) => onChange({ ...config, lockdown_minutes: Number(e.target.value) })} />
      </div>
    </div>
  );
}

function LinkConfig({ config, onChange }: { config: Record<string, unknown>; onChange: (c: Record<string, unknown>) => void }) {
  const allowlist = (config.allowlist as string[] | undefined) ?? [];
  const [input, setInput] = useState('');
  const add = () => {
    const trimmed = input.trim().toLowerCase();
    if (trimmed && !allowlist.includes(trimmed)) {
      onChange({ ...config, allowlist: [...allowlist, trimmed] });
    }
    setInput('');
  };
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs">Mode</Label>
        <Select value={String(config.mode ?? 'all')} onValueChange={(v) => onChange({ ...config, mode: v })}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Block all links</SelectItem>
            <SelectItem value="allowlist">Allow only listed domains</SelectItem>
            <SelectItem value="blocklist">Block listed domains only</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label className="text-xs">Domain allowlist</Label>
        <div className="flex gap-2">
          <Input placeholder="example.com" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())} className="font-mono text-sm" />
          <Button type="button" variant="outline" onClick={add}>Add</Button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {allowlist.map((d) => (
            <Badge key={d} variant="outline" className="gap-1 font-mono text-xs">
              {d}
              <button onClick={() => onChange({ ...config, allowlist: allowlist.filter((x) => x !== d) })} className="ml-1 opacity-60 hover:opacity-100">×</button>
            </Badge>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AutomodPage() {
  const params = useParams<{ guildId: string }>();
  const { user } = useAuth();
  const [rules, setRules] = useState<AutomodRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingRule, setEditingRule] = useState<AutomodRule | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AutomodRule | null>(null);
  const [addingType, setAddingType] = useState<RuleType | null>(null);
  const [editConfig, setEditConfig] = useState<Record<string, unknown>>({});
  const [editAction, setEditAction] = useState<AutomodAction>('delete');
  const [editDuration, setEditDuration] = useState(300);
  const [editExemptRoles, setEditExemptRoles] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!params?.guildId) return;
    const { data } = await supabase
      .from('automod_rules')
      .select('*')
      .eq('guild_id', params.guildId)
      .order('created_at');
    setRules((data || []) as AutomodRule[]);
    setLoading(false);
  }, [params?.guildId]);

  useEffect(() => { load(); }, [load]);

  const openEdit = (rule: AutomodRule) => {
    setEditingRule(rule);
    setEditConfig(rule.config);
    setEditAction(rule.action);
    setEditDuration(rule.action_duration_seconds ?? 300);
    setEditExemptRoles(rule.exempt_roles);
  };

  const openAdd = (type: RuleType) => {
    const meta = RULE_META[type];
    setAddingType(type);
    setEditConfig(meta.defaultConfig);
    setEditAction('delete');
    setEditDuration(300);
    setEditExemptRoles([]);
  };

  const toggleRule = async (id: string, enabled: boolean) => {
    setRules((prev) => prev.map((r) => (r.id === id ? { ...r, enabled } : r)));
    await supabase.from('automod_rules').update({ enabled, updated_at: new Date().toISOString() }).eq('id', id);
    toast.success(enabled ? 'Rule enabled' : 'Rule disabled');
  };

  const saveEdit = async () => {
    if (!editingRule && !addingType) return;
    setSaving(true);
    if (editingRule) {
      const updated = {
        config: editConfig,
        action: editAction,
        action_duration_seconds: editAction === 'mute' ? editDuration : null,
        exempt_roles: editExemptRoles,
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase.from('automod_rules').update(updated).eq('id', editingRule.id);
      if (error) { toast.error('Save failed', { description: error.message }); }
      else { toast.success('Rule updated'); }
    } else if (addingType) {
      const { error } = await supabase.from('automod_rules').insert({
        guild_id: params!.guildId,
        rule_type: addingType,
        enabled: true,
        config: editConfig,
        action: editAction,
        action_duration_seconds: editAction === 'mute' ? editDuration : null,
        exempt_roles: editExemptRoles,
        exempt_channels: [],
      });
      if (error) { toast.error('Create failed', { description: error.message }); }
      else {
        toast.success('Rule created');
        if (user) {
          await insertAuditLog({
            guild_id: params!.guildId,
            actor_discord_id: user.discordId,
            actor_username: user.username,
            action: `Created automod rule: ${RULE_META[addingType].label}`,
            category: 'system',
            details: { rule_type: addingType },
          });
        }
      }
    }
    setSaving(false);
    setEditingRule(null);
    setAddingType(null);
    load();
  };

  const deleteRule = async () => {
    if (!deleteTarget) return;
    await supabase.from('automod_rules').delete().eq('id', deleteTarget.id);
    toast.success('Rule deleted');
    setDeleteTarget(null);
    load();
  };

  const existingTypes = new Set(rules.map((r) => r.rule_type));
  const availableTypes = Object.keys(RULE_META).filter((t) => !existingTypes.has(t as RuleType)) as RuleType[];

  const isEditing = !!editingRule || !!addingType;
  const dialogTitle = editingRule
    ? `Edit: ${RULE_META[editingRule.rule_type].label}`
    : addingType
    ? `Add: ${RULE_META[addingType].label}`
    : '';
  const currentType = editingRule?.rule_type ?? addingType;

  function renderConfigEditor() {
    if (!currentType) return null;
    const props = { config: editConfig, onChange: setEditConfig };
    switch (currentType) {
      case 'spam': return <SpamConfig {...props} />;
      case 'word_filter': return <WordFilterConfig {...props} />;
      case 'caps_lock': return <CapsConfig {...props} />;
      case 'mention_spam': return <MentionConfig {...props} />;
      case 'raid_protection': return <RaidConfig {...props} />;
      case 'link_block': return <LinkConfig {...props} />;
      case 'invite_block': return (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Switch checked={Boolean(editConfig.allow_own_server)} onCheckedChange={(v) => setEditConfig((c) => ({ ...c, allow_own_server: v }))} />
            <Label className="text-xs">Allow invites to this server</Label>
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={Boolean(editConfig.log_attempts)} onCheckedChange={(v) => setEditConfig((c) => ({ ...c, log_attempts: v }))} />
            <Label className="text-xs">Log blocked attempts in mod log</Label>
          </div>
        </div>
      );
      default: return null;
    }
  }

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <ShieldAlert className="h-6 w-6 animate-pulse text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Auto-Moderation</h2>
          <p className="text-sm text-muted-foreground">
            Rules run automatically on every message. Stack multiple rules for layered protection.
          </p>
        </div>
        {availableTypes.length > 0 && (
          <Collapsible>
            <CollapsibleTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Add rule
                <ChevronDown className="h-3.5 w-3.5" />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="absolute z-10 mt-2 w-64 rounded-xl border border-border/60 bg-popover p-2 shadow-xl">
              {availableTypes.map((t) => {
                const meta = RULE_META[t];
                const Icon = meta.icon;
                return (
                  <button
                    key={t}
                    onClick={() => openAdd(t)}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-accent/10"
                  >
                    <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', meta.color)}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{meta.label}</p>
                      <p className="text-[10px] text-muted-foreground line-clamp-1">{meta.description}</p>
                    </div>
                  </button>
                );
              })}
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>

      {rules.length === 0 ? (
        <Card className="glass p-12 text-center">
          <ShieldAlert className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <p className="font-medium text-foreground">No auto-mod rules configured.</p>
          <p className="mt-1 text-sm text-muted-foreground">Add your first rule above to start protecting this server.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => (
            <RuleCard
              key={rule.id}
              rule={rule}
              onToggle={toggleRule}
              onEdit={openEdit}
              onDelete={setDeleteTarget}
            />
          ))}
        </div>
      )}

      {/* Quick-add cards for empty state */}
      {rules.length === 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {availableTypes.map((t) => {
            const meta = RULE_META[t];
            const Icon = meta.icon;
            return (
              <button
                key={t}
                onClick={() => openAdd(t)}
                className="glass flex items-center gap-4 rounded-xl border border-border/60 p-4 text-left transition-all hover:border-primary/40 hover:shadow-lg"
              >
                <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', meta.color)}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">{meta.label}</p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{meta.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Edit / Add Dialog */}
      <Dialog open={isEditing} onOpenChange={(o) => { if (!o) { setEditingRule(null); setAddingType(null); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
            <DialogDescription>
              Configure this rule's parameters, action, and exemptions.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-2">
            {renderConfigEditor()}

            <Separator />

            <div className="space-y-3">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Action</Label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {ACTIONS.map((a) => (
                  <button
                    key={a.value}
                    type="button"
                    onClick={() => setEditAction(a.value)}
                    className={cn(
                      'rounded-lg border px-3 py-2 text-xs font-medium transition-all',
                      editAction === a.value
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border/60 text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
              {editAction === 'mute' && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Timeout duration (seconds)</Label>
                  <Input
                    type="number"
                    value={editDuration}
                    onChange={(e) => setEditDuration(Number(e.target.value))}
                    className="w-40"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    = {Math.round(editDuration / 60)} minute{Math.round(editDuration / 60) !== 1 ? 's' : ''}
                  </p>
                </div>
              )}
            </div>

            <Separator />

            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Exempt roles</Label>
              <div className="space-y-1.5">
                {DEMO_ROLES.map((role) => (
                  <div key={role.id} className="flex items-center justify-between rounded-lg border border-border/60 bg-background-elevated/40 px-3 py-2">
                    <span className="text-sm text-foreground">@{role.name}</span>
                    <Switch
                      checked={editExemptRoles.includes(role.id)}
                      onCheckedChange={(v) =>
                        setEditExemptRoles((prev) =>
                          v ? [...prev, role.id] : prev.filter((id) => id !== role.id)
                        )
                      }
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setEditingRule(null); setAddingType(null); }}>Cancel</Button>
            <Button onClick={saveEdit} disabled={saving} className="gap-2">
              <Save className="h-4 w-4" />
              {saving ? 'Saving…' : 'Save rule'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget ? RULE_META[deleteTarget.rule_type].label : 'rule'}?</AlertDialogTitle>
            <AlertDialogDescription>
              This rule will be permanently removed. You can recreate it at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={deleteRule}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

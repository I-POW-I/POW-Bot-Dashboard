'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Check,
  ChevronRight,
  Edit3,
  GripVertical,
  Plus,
  Save,
  Smile,
  Tags,
  Trash2,
  X,
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
import { cn } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────

type RRMode = 'single' | 'multiple' | 'verify';

interface ReactionRole {
  id: string;
  group_id: string;
  emoji: string;
  role_id: string;
  label: string | null;
  description: string | null;
  position: number;
}

interface ReactionRoleGroup {
  id: string;
  guild_id: string;
  channel_id: string;
  message_id: string | null;
  title: string;
  description: string | null;
  mode: RRMode;
  max_roles: number | null;
  enabled: boolean;
  reaction_roles?: ReactionRole[];
}

const MODE_META: Record<RRMode, { label: string; description: string }> = {
  single: {
    label: 'Single',
    description: 'Users may only hold one role from this group at a time.',
  },
  multiple: {
    label: 'Multiple',
    description: 'Users can hold any combination of roles up to the max.',
  },
  verify: {
    label: 'Verify',
    description: 'Click to verify membership — role is toggled once and locked.',
  },
};

const groupSchema = z.object({
  title: z.string().min(1, 'Title is required').max(128),
  description: z.string().max(512).optional().default(''),
  channel_id: z.string().min(1, 'Channel ID is required'),
  message_id: z.string().optional().default(''),
  mode: z.enum(['single', 'multiple', 'verify']),
  max_roles: z.coerce.number().int().min(1).max(20).optional(),
  enabled: z.boolean().default(true),
});
type GroupFormValues = z.infer<typeof groupSchema>;

const roleSchema = z.object({
  emoji: z.string().min(1, 'Emoji is required'),
  role_id: z.string().min(1, 'Role ID is required'),
  label: z.string().max(64).optional().default(''),
  description: z.string().max(256).optional().default(''),
});
type RoleFormValues = z.infer<typeof roleSchema>;

// ── Page ───────────────────────────────────────────────────────────────────────

export default function ReactionRolesPage() {
  const params = useParams<{ guildId: string }>();
  const guildId = params.guildId;
  const { user } = useAuth();

  const [groups, setGroups] = useState<ReactionRoleGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<ReactionRoleGroup | null>(null);
  const [deleteGroup, setDeleteGroup] = useState<ReactionRoleGroup | null>(null);
  const [roleDialogFor, setRoleDialogFor] = useState<ReactionRoleGroup | null>(null);
  const [editingRole, setEditingRole] = useState<ReactionRole | null>(null);
  const [deleteRole, setDeleteRole] = useState<ReactionRole | null>(null);

  const groupForm = useForm<GroupFormValues>({
    resolver: zodResolver(groupSchema),
    defaultValues: {
      title: '',
      description: '',
      channel_id: '',
      message_id: '',
      mode: 'multiple',
      max_roles: 5,
      enabled: true,
    },
  });

  const roleForm = useForm<RoleFormValues>({
    resolver: zodResolver(roleSchema),
    defaultValues: { emoji: '', role_id: '', label: '', description: '' },
  });

  const loadGroups = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('reaction_role_groups')
      .select('*, reaction_roles(*)')
      .eq('guild_id', guildId)
      .order('created_at', { ascending: false });
    if (error) toast.error('Failed to load reaction role groups');
    else setGroups((data ?? []) as ReactionRoleGroup[]);
    setLoading(false);
  }, [guildId]);

  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  // Group handlers
  const openCreateGroup = () => {
    setEditingGroup(null);
    groupForm.reset({
      title: '',
      description: '',
      channel_id: '',
      message_id: '',
      mode: 'multiple',
      max_roles: 5,
      enabled: true,
    });
    setGroupDialogOpen(true);
  };

  const openEditGroup = (g: ReactionRoleGroup) => {
    setEditingGroup(g);
    groupForm.reset({
      title: g.title,
      description: g.description ?? '',
      channel_id: g.channel_id,
      message_id: g.message_id ?? '',
      mode: g.mode,
      max_roles: g.max_roles ?? 5,
      enabled: g.enabled,
    });
    setGroupDialogOpen(true);
  };

  const submitGroup = async (v: GroupFormValues) => {
    const payload = {
      guild_id: guildId,
      title: v.title,
      description: v.description || null,
      channel_id: v.channel_id,
      message_id: v.message_id || null,
      mode: v.mode,
      max_roles: v.mode === 'multiple' ? v.max_roles ?? 5 : null,
      enabled: v.enabled,
    };
    if (editingGroup) {
      const { error } = await supabase
        .from('reaction_role_groups')
        .update(payload)
        .eq('id', editingGroup.id);
      if (error) return toast.error(error.message);
      toast.success('Reaction role group updated');
      if (user) {
        await insertAuditLog({
          guild_id: guildId,
          actor_discord_id: user.discordId,
          actor_username: user.username,
          action: `Updated reaction role group: ${v.title}`,
          category: 'system',
          details: { title: v.title },
        });
      }
    } else {
      const { error } = await supabase.from('reaction_role_groups').insert(payload);
      if (error) return toast.error(error.message);
      toast.success('Reaction role group created');
      if (user) {
        await insertAuditLog({
          guild_id: guildId,
          actor_discord_id: user.discordId,
          actor_username: user.username,
          action: `Created reaction role group: ${v.title}`,
          category: 'system',
          details: { title: v.title },
        });
      }
    }
    setGroupDialogOpen(false);
    loadGroups();
  };

  const toggleGroup = async (g: ReactionRoleGroup, enabled: boolean) => {
    const { error } = await supabase
      .from('reaction_role_groups')
      .update({ enabled })
      .eq('id', g.id);
    if (error) return toast.error(error.message);
    toast.success(`Group "${g.title}" ${enabled ? 'enabled' : 'disabled'}`);
    setGroups((prev) =>
      prev.map((x) => (x.id === g.id ? { ...x, enabled } : x))
    );
  };

  const confirmDeleteGroup = async () => {
    if (!deleteGroup) return;
    const { error } = await supabase
      .from('reaction_role_groups')
      .delete()
      .eq('id', deleteGroup.id);
    if (error) return toast.error(error.message);
    toast.success('Group deleted');
    if (user) {
      await insertAuditLog({
        guild_id: guildId,
        actor_discord_id: user.discordId,
        actor_username: user.username,
        action: `Deleted reaction role group: ${deleteGroup.title}`,
        category: 'system',
        details: { title: deleteGroup.title },
      });
    }
    setDeleteGroup(null);
    loadGroups();
  };

  // Role handlers
  const openAddRole = (g: ReactionRoleGroup) => {
    setRoleDialogFor(g);
    setEditingRole(null);
    roleForm.reset({ emoji: '', role_id: '', label: '', description: '' });
  };

  const openEditRole = (g: ReactionRoleGroup, r: ReactionRole) => {
    setRoleDialogFor(g);
    setEditingRole(r);
    roleForm.reset({
      emoji: r.emoji,
      role_id: r.role_id,
      label: r.label ?? '',
      description: r.description ?? '',
    });
  };

  const submitRole = async (v: RoleFormValues) => {
    if (!roleDialogFor) return;
    const payload = {
      group_id: roleDialogFor.id,
      emoji: v.emoji,
      role_id: v.role_id,
      label: v.label || null,
      description: v.description || null,
      position: editingRole?.position ?? (roleDialogFor.reaction_roles?.length ?? 0),
    };
    if (editingRole) {
      const { error } = await supabase
        .from('reaction_roles')
        .update(payload)
        .eq('id', editingRole.id);
      if (error) return toast.error(error.message);
      toast.success('Reaction role updated');
    } else {
      const { error } = await supabase.from('reaction_roles').insert(payload);
      if (error) return toast.error(error.message);
      toast.success('Reaction role added');
    }
    setRoleDialogFor(null);
    loadGroups();
  };

  const confirmDeleteRole = async () => {
    if (!deleteRole) return;
    const { error } = await supabase
      .from('reaction_roles')
      .delete()
      .eq('id', deleteRole.id);
    if (error) return toast.error(error.message);
    toast.success('Reaction role removed');
    setDeleteRole(null);
    loadGroups();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Tags className="h-6 w-6 text-primary" />
            Reaction Roles
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Bind emojis to roles so members can self-assign by reacting.
          </p>
        </div>
        <Button onClick={openCreateGroup} className="gap-2">
          <Plus className="h-4 w-4" />
          New Group
        </Button>
      </div>

      {loading ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {[...Array(2)].map((_, i) => (
            <Card key={i} className="h-64 animate-pulse bg-muted/30" />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
              <Smile className="h-7 w-7 text-primary" />
            </div>
            <div>
              <h3 className="text-base font-semibold">No reaction role groups yet</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Create a group, add emoji-role pairs, and post a message for members to react to.
              </p>
            </div>
            <Button onClick={openCreateGroup} className="gap-2">
              <Plus className="h-4 w-4" />
              Create Group
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {groups.map((g) => (
            <Card key={g.id} className={cn(!g.enabled && 'opacity-60')}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-base">
                      {g.title}
                      <Badge variant="outline" className="text-[10px]">
                        {MODE_META[g.mode].label}
                      </Badge>
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {g.description || MODE_META[g.mode].description}
                    </CardDescription>
                  </div>
                  <Switch
                    checked={g.enabled}
                    onCheckedChange={(v) => toggleGroup(g, v)}
                  />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-md border border-border/60 bg-muted/30 p-2 text-xs text-muted-foreground">
                  <div className="flex items-center justify-between">
                    <span>Channel: <code className="font-mono">{g.channel_id}</code></span>
                    {g.message_id && (
                      <span>Message: <code className="font-mono">{g.message_id}</code></span>
                    )}
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  {g.reaction_roles && g.reaction_roles.length > 0 ? (
                    g.reaction_roles
                      .sort((a, b) => a.position - b.position)
                      .map((r) => (
                        <div
                          key={r.id}
                          className="group flex items-center gap-3 rounded-md border border-border/60 bg-card/60 p-2"
                        >
                          <GripVertical className="h-4 w-4 text-muted-foreground/50" />
                          <span className="text-xl">{r.emoji}</span>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium">
                              {r.label || `Role ${r.role_id}`}
                            </div>
                            <div className="truncate text-xs text-muted-foreground">
                              {r.description || `Role ID: ${r.role_id}`}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              onClick={() => openEditRole(g, r)}
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-destructive"
                              onClick={() => setDeleteRole(r)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))
                  ) : (
                    <p className="py-4 text-center text-xs text-muted-foreground">
                      No emoji-role pairs yet.
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between pt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    onClick={() => openAddRole(g)}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Role
                  </Button>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="gap-1.5"
                      onClick={() => openEditGroup(g)}
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      Edit Group
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="gap-1.5 text-destructive"
                      onClick={() => setDeleteGroup(g)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Group Dialog */}
      <Dialog open={groupDialogOpen} onOpenChange={setGroupDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingGroup ? 'Edit Group' : 'New Reaction Role Group'}</DialogTitle>
            <DialogDescription>
              A group binds one Discord message to a set of emoji-role pairs.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={groupForm.handleSubmit(submitGroup)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="title">Title</Label>
              <Input id="title" {...groupForm.register('title')} placeholder="Color Roles" />
              {groupForm.formState.errors.title && (
                <p className="text-xs text-destructive">{groupForm.formState.errors.title.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                rows={2}
                {...groupForm.register('description')}
                placeholder="React to pick your color role"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="channel_id">Channel ID</Label>
                <Input id="channel_id" {...groupForm.register('channel_id')} placeholder="1234567890" />
                {groupForm.formState.errors.channel_id && (
                  <p className="text-xs text-destructive">{groupForm.formState.errors.channel_id.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="message_id">Message ID (optional)</Label>
                <Input id="message_id" {...groupForm.register('message_id')} placeholder="Auto-create if empty" />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="mode">Mode</Label>
                <Select
                  value={groupForm.watch('mode')}
                  onValueChange={(v) => groupForm.setValue('mode', v as RRMode)}
                >
                  <SelectTrigger id="mode">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(MODE_META) as RRMode[]).map((m) => (
                      <SelectItem key={m} value={m}>
                        {MODE_META[m].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {MODE_META[groupForm.watch('mode')].description}
                </p>
              </div>
              {groupForm.watch('mode') === 'multiple' && (
                <div className="space-y-1.5">
                  <Label htmlFor="max_roles">Max Roles</Label>
                  <Input
                    id="max_roles"
                    type="number"
                    min={1}
                    max={20}
                    {...groupForm.register('max_roles', { valueAsNumber: true })}
                  />
                </div>
              )}
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Switch
                checked={groupForm.watch('enabled')}
                onCheckedChange={(v) => groupForm.setValue('enabled', v)}
              />
              Enabled
            </label>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setGroupDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="gap-2">
                <Save className="h-4 w-4" />
                {editingGroup ? 'Save' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Role Dialog */}
      <Dialog
        open={!!roleDialogFor}
        onOpenChange={(o) => !o && setRoleDialogFor(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Smile className="h-5 w-5 text-primary" />
              {editingRole ? 'Edit Reaction Role' : 'Add Reaction Role'}
            </DialogTitle>
            <DialogDescription>
              {roleDialogFor && `For group "${roleDialogFor.title}"`}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={roleForm.handleSubmit(submitRole)} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="emoji">Emoji</Label>
                <Input id="emoji" {...roleForm.register('emoji')} placeholder="🔴" />
                {roleForm.formState.errors.emoji && (
                  <p className="text-xs text-destructive">{roleForm.formState.errors.emoji.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="role_id">Role ID</Label>
                <Input id="role_id" {...roleForm.register('role_id')} placeholder="1234567890" />
                {roleForm.formState.errors.role_id && (
                  <p className="text-xs text-destructive">{roleForm.formState.errors.role_id.message}</p>
                )}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="label">Label</Label>
              <Input id="label" {...roleForm.register('label')} placeholder="Red Team" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="description">Description</Label>
              <Input id="description" {...roleForm.register('description')} placeholder="Members of the red faction" />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setRoleDialogFor(null)}>
                Cancel
              </Button>
              <Button type="submit" className="gap-2">
                <Save className="h-4 w-4" />
                {editingRole ? 'Save' : 'Add'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Group */}
      <AlertDialog
        open={!!deleteGroup}
        onOpenChange={(o) => !o && setDeleteGroup(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete group "{deleteGroup?.title}"?</AlertDialogTitle>
            <AlertDialogDescription>
              All reaction role bindings in this group will also be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteGroup}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Role */}
      <AlertDialog
        open={!!deleteRole}
        onOpenChange={(o) => !o && setDeleteRole(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this reaction role?</AlertDialogTitle>
            <AlertDialogDescription>
              Emoji {deleteRole?.emoji} will no longer grant the associated role.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteRole}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

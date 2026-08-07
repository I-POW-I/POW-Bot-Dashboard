'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  ChevronRight,
  Command as CommandIcon,
  Edit3,
  Eye,
  Plus,
  Save,
  Slash,
  Terminal,
  Trash2,
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

type ResponseType = 'text' | 'embed' | 'random';

interface CustomCommand {
  id: string;
  guild_id: string;
  name: string;
  description: string | null;
  response_type: ResponseType;
  response_content: string;
  required_role_id: string | null;
  enabled: boolean;
  cooldown_seconds: number;
  usage_count: number;
  created_by: string | null;
  created_at: string;
}

const RESPONSE_TYPES: Record<
  ResponseType,
  { label: string; description: string; placeholder: string }
> = {
  text: {
    label: 'Plain Text',
    description: 'A simple text response.',
    placeholder: 'Hello, {user}! Welcome to our server.',
  },
  embed: {
    label: 'Embed JSON',
    description: 'A Discord embed JSON payload.',
    placeholder:
      '{"title":"Welcome","description":"Hello {user}","color":5816575}',
  },
  random: {
    label: 'Random Line',
    description: 'One random line per invocation (newline-separated).',
    placeholder: 'Heads!\nTails!\nThe coin landed on its edge...',
  },
};

const commandSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(32, 'Max 32 characters')
    .regex(/^[a-z0-9-_]+$/i, 'Letters, numbers, hyphens, underscores only'),
  description: z.string().max(256, 'Max 256 characters').optional().default(''),
  response_type: z.enum(['text', 'embed', 'random']),
  response_content: z.string().min(1, 'Response content is required'),
  required_role_id: z.string().optional().default(''),
  enabled: z.boolean().default(true),
  cooldown_seconds: z.coerce.number().int().min(0).max(86400).default(0),
});
type CommandFormValues = z.infer<typeof commandSchema>;

// ── Page ───────────────────────────────────────────────────────────────────────

export default function CommandsPage() {
  const params = useParams<{ guildId: string }>();
  const guildId = params.guildId;
  const { user } = useAuth();

  const [commands, setCommands] = useState<CustomCommand[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CustomCommand | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CustomCommand | null>(null);

  const form = useForm<CommandFormValues>({
    resolver: zodResolver(commandSchema),
    defaultValues: {
      name: '',
      description: '',
      response_type: 'text',
      response_content: '',
      required_role_id: '',
      enabled: true,
      cooldown_seconds: 0,
    },
  });

  const loadCommands = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('custom_commands')
      .select('*')
      .eq('guild_id', guildId)
      .order('created_at', { ascending: false });
    if (error) toast.error('Failed to load commands');
    else setCommands((data ?? []) as CustomCommand[]);
    setLoading(false);
  }, [guildId]);

  useEffect(() => {
    loadCommands();
  }, [loadCommands]);

  const openCreate = () => {
    setEditing(null);
    form.reset({
      name: '',
      description: '',
      response_type: 'text',
      response_content: '',
      required_role_id: '',
      enabled: true,
      cooldown_seconds: 0,
    });
    setDialogOpen(true);
  };

  const openEdit = (cmd: CustomCommand) => {
    setEditing(cmd);
    form.reset({
      name: cmd.name,
      description: cmd.description ?? '',
      response_type: cmd.response_type,
      response_content: cmd.response_content,
      required_role_id: cmd.required_role_id ?? '',
      enabled: cmd.enabled,
      cooldown_seconds: cmd.cooldown_seconds,
    });
    setDialogOpen(true);
  };

  const onSubmit = async (values: CommandFormValues) => {
    const payload = {
      guild_id: guildId,
      name: values.name.toLowerCase(),
      description: values.description || null,
      response_type: values.response_type,
      response_content: values.response_content,
      required_role_id: values.required_role_id || null,
      enabled: values.enabled,
      cooldown_seconds: values.cooldown_seconds,
    };

    if (editing) {
      const { error } = await supabase
        .from('custom_commands')
        .update(payload)
        .eq('id', editing.id);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success(`Command "${payload.name}" updated`);
      if (user) {
        await insertAuditLog({
          guild_id: guildId,
          actor_discord_id: user.discordId,
          actor_username: user.username,
          action: `Updated custom command: ${payload.name}`,
          category: 'system',
          details: { name: payload.name },
        });
      }
    } else {
      const { error } = await supabase.from('custom_commands').insert({
        ...payload,
        created_by: user?.discordId ?? null,
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success(`Command "${payload.name}" created`);
      if (user) {
        await insertAuditLog({
          guild_id: guildId,
          actor_discord_id: user.discordId,
          actor_username: user.username,
          action: `Created custom command: ${payload.name}`,
          category: 'system',
          details: { name: payload.name },
        });
      }
    }
    setDialogOpen(false);
    loadCommands();
  };

  const toggleEnabled = async (cmd: CustomCommand, enabled: boolean) => {
    const { error } = await supabase
      .from('custom_commands')
      .update({ enabled })
      .eq('id', cmd.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Command "${cmd.name}" ${enabled ? 'enabled' : 'disabled'}`);
    setCommands((prev) =>
      prev.map((c) => (c.id === cmd.id ? { ...c, enabled } : c))
    );
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase
      .from('custom_commands')
      .delete()
      .eq('id', deleteTarget.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Command "${deleteTarget.name}" deleted`);
    if (user) {
      await insertAuditLog({
        guild_id: guildId,
        actor_discord_id: user.discordId,
        actor_username: user.username,
        action: `Deleted custom command: ${deleteTarget.name}`,
        category: 'system',
        details: { name: deleteTarget.name },
      });
    }
    setDeleteTarget(null);
    loadCommands();
  };

  const responseType = form.watch('response_type');

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Terminal className="h-6 w-6 text-primary" />
            Custom Commands
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Create slash or prefix commands that respond with text, embeds, or random lines.
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          New Command
        </Button>
      </div>

      <Card className="border-dashed">
        <CardContent className="flex items-start gap-3 pt-6 text-sm text-muted-foreground">
          <CommandIcon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div>
            Commands are invoked with <code className="rounded bg-muted px-1.5 py-0.5 text-xs">!{'<name>'}</code> by default.
            Use <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{'{user}'}</code>, <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{'{server}'}</code>, <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{'{channel}'}</code> as placeholders.
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="h-44 animate-pulse bg-muted/30" />
          ))}
        </div>
      ) : commands.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
              <Terminal className="h-7 w-7 text-primary" />
            </div>
            <div>
              <h3 className="text-base font-semibold">No custom commands yet</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Create your first command to automate responses in your server.
              </p>
            </div>
            <Button onClick={openCreate} className="gap-2">
              <Plus className="h-4 w-4" />
              Create Command
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {commands.map((cmd) => (
            <Card
              key={cmd.id}
              className={cn(
                'group relative transition-all hover:shadow-md',
                !cmd.enabled && 'opacity-60'
              )}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Slash className="h-4 w-4" />
                    </div>
                    <div>
                      <CardTitle className="text-base font-semibold">
                        !{cmd.name}
                      </CardTitle>
                      <CardDescription className="text-xs">
                        {cmd.description || 'No description'}
                      </CardDescription>
                    </div>
                  </div>
                  <Switch
                    checked={cmd.enabled}
                    onCheckedChange={(v) => toggleEnabled(cmd, v)}
                  />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant="secondary" className="text-[10px]">
                    {RESPONSE_TYPES[cmd.response_type].label}
                  </Badge>
                  {cmd.cooldown_seconds > 0 && (
                    <Badge variant="outline" className="text-[10px]">
                      {cmd.cooldown_seconds}s cooldown
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-[10px]">
                    {cmd.usage_count} uses
                  </Badge>
                </div>
                <div className="rounded-md border border-border/60 bg-muted/30 p-2 text-xs text-muted-foreground">
                  <span className="line-clamp-2 font-mono">
                    {cmd.response_content}
                  </span>
                </div>
                <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 gap-1.5 text-xs"
                    onClick={() => openEdit(cmd)}
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 gap-1.5 text-xs text-destructive"
                    onClick={() => setDeleteTarget(cmd)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CommandIcon className="h-5 w-5 text-primary" />
              {editing ? 'Edit Command' : 'New Custom Command'}
            </DialogTitle>
            <DialogDescription>
              Define a trigger name, response payload, and optional restrictions.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="name">Command Name</Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">!</span>
                  <Input id="name" {...form.register('name')} placeholder="welcome" />
                </div>
                {form.formState.errors.name && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.name.message}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="response_type">Response Type</Label>
                <Select
                  value={form.watch('response_type')}
                  onValueChange={(v) =>
                    form.setValue('response_type', v as ResponseType)
                  }
                >
                  <SelectTrigger id="response_type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(RESPONSE_TYPES) as ResponseType[]).map((t) => (
                      <SelectItem key={t} value={t}>
                        {RESPONSE_TYPES[t].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="description">Description (optional)</Label>
              <Input
                id="description"
                {...form.register('description')}
                placeholder="What this command does"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="response_content">
                Response Content
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  {RESPONSE_TYPES[responseType].description}
                </span>
              </Label>
              <Textarea
                id="response_content"
                rows={6}
                className="font-mono text-xs"
                {...form.register('response_content')}
                placeholder={RESPONSE_TYPES[responseType].placeholder}
              />
              {form.formState.errors.response_content && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.response_content.message}
                </p>
              )}
            </div>

            <Separator />

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="cooldown_seconds">Cooldown (seconds)</Label>
                <Input
                  id="cooldown_seconds"
                  type="number"
                  min={0}
                  max={86400}
                  {...form.register('cooldown_seconds', { valueAsNumber: true })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="required_role_id">Required Role ID</Label>
                <Input
                  id="required_role_id"
                  {...form.register('required_role_id')}
                  placeholder="Optional"
                />
              </div>
              <div className="flex items-end pb-2">
                <label className="flex items-center gap-2 text-sm">
                  <Switch
                    checked={form.watch('enabled')}
                    onCheckedChange={(v) => form.setValue('enabled', v)}
                  />
                  Enabled
                </label>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" className="gap-2">
                <Save className="h-4 w-4" />
                {editing ? 'Save Changes' : 'Create Command'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete command "!{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the command. Usage history will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

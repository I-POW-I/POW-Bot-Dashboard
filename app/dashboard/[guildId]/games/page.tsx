'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Gamepad2, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { fetchGameAlerts, insertAuditLog } from '@/lib/data';
import type { GameSubscription } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
  DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';

const DEMO_TEXT_CHANNELS = [
  { id: '9182736451029384', name: 'free-games' },
  { id: '9182736451029388', name: 'general' },
];

const DEMO_ROLES = [
  { id: '9182736451029398', name: 'Free Games Ping' },
  { id: '9182736451029399', name: '@everyone' },
];

const POPULAR_GAMES = [
  { app_id: '730', name: 'Counter-Strike 2' },
  { app_id: '1089980', name: 'Genshin Impact' },
  { app_id: '570', name: 'Dota 2' },
  { app_id: '1172470', name: 'Apex Legends' },
  { app_id: '1599340', name: 'Deadlock' },
  { app_id: '1245620', name: 'ELDEN RING' },
];

export default function GamesPage() {
  const params = useParams<{ guildId: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const [games, setGames] = useState<GameSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    appId: '730',
    gameName: 'Counter-Strike 2',
    channelId: DEMO_TEXT_CHANNELS[0].id,
    roleId: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user || !params?.guildId) return;
    (async () => {
      const g = await fetchGameAlerts(params.guildId);
      setGames(g);
      setLoading(false);
    })();
  }, [user, params?.guildId]);

  const addGame = async () => {
    if (!params?.guildId || !user) return;
    setSaving(true);
    const { data, error } = await supabase
      .from('game_subscriptions')
      .insert({
        guild_id: params.guildId,
        app_id: form.appId,
        game_name: form.gameName,
        channel_id: form.channelId,
        role_id: form.roleId || null,
        color: 0x5865f2,
      })
      .select()
      .single();
    if (error) {
      toast({ title: 'Add failed', description: error.message, variant: 'destructive' });
      setSaving(false);
      return;
    }
    setGames([data as GameSubscription, ...games]);
    await insertAuditLog({
      guild_id: params.guildId,
      actor_discord_id: user.discordId,
      actor_username: user.username,
      action: `Added game alert for ${form.gameName}`,
      category: 'streamers',
      details: { appId: form.appId, gameName: form.gameName },
    });
    toast({ title: 'Game alert added', description: form.gameName });
    setOpen(false);
    setSaving(false);
  };

  const removeGame = async (id: number, name: string | null) => {
    const { error } = await supabase.from('game_subscriptions').delete().eq('id', id);
    if (error) {
      toast({ title: 'Remove failed', description: error.message, variant: 'destructive' });
      return;
    }
    setGames(games.filter((g) => g.id !== id));
    if (user && params?.guildId) {
      await insertAuditLog({
        guild_id: params.guildId,
        actor_discord_id: user.discordId,
        actor_username: user.username,
        action: `Removed game alert for ${name || 'Unknown'}`,
        category: 'streamers',
        details: { gameId: id },
      });
    }
    toast({ title: 'Game alert removed' });
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Gamepad2 className="h-6 w-6 animate-pulse text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            Game Alerts
          </h2>
          <p className="text-sm text-muted-foreground">
            Get pinged when a tracked game goes free or posts an update.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Add game
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add a game alert</DialogTitle>
              <DialogDescription>
                The bot will post an embed when this game has news or goes free.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Game</Label>
                <Select
                  value={form.appId}
                  onValueChange={(v) => {
                    setForm({
                      ...form,
                      appId: v,
                      gameName: POPULAR_GAMES.find((g) => g.app_id === v)?.name || v,
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {POPULAR_GAMES.map((g) => (
                      <SelectItem key={g.app_id} value={g.app_id}>
                        {g.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Post to</Label>
                  <Select
                    value={form.channelId}
                    onValueChange={(v) => setForm({ ...form, channelId: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DEMO_TEXT_CHANNELS.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          # {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Ping role (optional)</Label>
                  <Select
                    value={form.roleId || '__none'}
                    onValueChange={(v) => setForm({ ...form, roleId: v === '__none' ? '' : v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">— No ping —</SelectItem>
                      {DEMO_ROLES.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          @ {r.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={addGame} disabled={saving}>
                {saving ? 'Adding…' : 'Add alert'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {games.length === 0 ? (
        <Card className="glass p-12 text-center">
          <Gamepad2 className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
          <p className="text-muted-foreground">
            No game alerts configured. Click "Add game" to start.
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {games.map((g) => (
            <Card key={g.id} className="glass">
              <CardContent className="p-5">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Gamepad2 className="h-6 w-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold text-foreground">
                      {g.game_name || 'Unknown game'}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      App ID: {g.app_id}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="outline" className="text-muted-foreground">
                        # {DEMO_TEXT_CHANNELS.find((c) => c.id === g.channel_id)?.name || g.channel_id}
                      </Badge>
                      {g.role_id && (
                        <Badge variant="outline" className="text-muted-foreground">
                          @ {DEMO_ROLES.find((r) => r.id === g.role_id)?.name || 'role'}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => removeGame(g.id, g.game_name)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

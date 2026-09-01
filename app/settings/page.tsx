'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import {
  Bell,
  Bot,
  Globe,
  Monitor,
  Moon,
  Palette,
  Plug,
  Save,
  Shield,
  Sun,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useTheme } from 'next-themes';
import { useAuth } from '@/components/providers/auth-provider';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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

const generalSchema = z.object({
  app_name: z.string().min(1, 'App name is required'),
  timezone: z.string().min(1, 'Timezone is required'),
  locale: z.string().min(1, 'Locale is required'),
});
type GeneralForm = z.infer<typeof generalSchema>;

const securitySchema = z.object({
  session_timeout_minutes: z.coerce.number().min(5, 'Minimum 5 minutes').max(1440, 'Maximum 1440 minutes'),
  two_factor: z.boolean(),
  password_min_length: z.coerce.number().min(8, 'Minimum 8').max(64, 'Maximum 64'),
  password_require_special: z.boolean(),
});
type SecurityForm = z.infer<typeof securitySchema>;

const TIMEZONES = ['UTC', 'America/New_York', 'America/Chicago', 'America/Los_Angeles', 'Europe/London', 'Europe/Paris', 'Asia/Tokyo', 'Australia/Sydney'];
const LOCALES = ['en-US', 'en-GB', 'fr-FR', 'de-DE', 'es-ES', 'ja-JP', 'pt-BR'];
const ACCENTS = [
  { name: 'Blue', value: '199 89% 52%' },
  { name: 'Green', value: '142 71% 45%' },
  { name: 'Amber', value: '38 92% 50%' },
  { name: 'Rose', value: '340 75% 60%' },
];

const INTEGRATIONS = [
  { key: 'discord', label: 'Discord Bot', description: 'Core bot connection' },
  { key: 'twitch', label: 'Twitch API', description: 'Streamer alerts' },
  { key: 'kick', label: 'Kick API', description: 'Streamer alerts' },
  { key: 'youtube', label: 'YouTube Data API', description: 'Streamer alerts' },
  { key: 'steam', label: 'Steam Web API', description: 'Free game alerts' },
];

export default function SettingsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [settings, setSettings] = useState<any>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [accent, setAccent] = useState('199 89% 52%');
  const [integrations, setIntegrations] = useState<Record<string, boolean>>({});
  const [dangerOpen, setDangerOpen] = useState(false);

  const generalForm = useForm<GeneralForm>({
    resolver: zodResolver(generalSchema),
    defaultValues: { app_name: 'POW Bot Dashboard', timezone: 'UTC', locale: 'en-US' },
  });
  const securityForm = useForm<SecurityForm>({
    resolver: zodResolver(securitySchema),
    defaultValues: { session_timeout_minutes: 60, two_factor: false, password_min_length: 12, password_require_special: true },
  });

  useEffect(() => {
    if (!loading && !user) router.replace('/');
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();
      if (!authUser) return;
      const { data } = await supabase
        .from('app_settings')
        .select('*')
        .eq('user_id', authUser.id)
        .maybeSingle();
      if (data) {
        setSettings(data);
        generalForm.reset(data.general);
        securityForm.reset(data.security);
        setIntegrations(data.integrations || {});
        if (data.appearance?.accent) setAccent(data.appearance.accent);
        if (data.appearance?.theme) setTheme(data.appearance.theme);
      }
      setDataLoading(false);
    })();
  }, [user]);

  const saveGeneral = async (values: GeneralForm) => {
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    if (!authUser) return;
    const updated = { ...settings, general: values, updated_at: new Date().toISOString() };
    setSettings(updated);
    await supabase.from('app_settings').update(updated).eq('user_id', authUser.id);
    toast.success('General settings saved');
  };

  const saveSecurity = async (values: SecurityForm) => {
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    if (!authUser) return;
    const updated = { ...settings, security: values, updated_at: new Date().toISOString() };
    setSettings(updated);
    await supabase.from('app_settings').update(updated).eq('user_id', authUser.id);
    toast.success('Security settings saved');
  };

  const saveAppearance = async (themeValue: string, accentValue: string) => {
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    if (!authUser) return;
    const updated = {
      ...settings,
      appearance: { theme: themeValue, accent: accentValue },
      updated_at: new Date().toISOString(),
    };
    setSettings(updated);
    await supabase.from('app_settings').update(updated).eq('user_id', authUser.id);
    toast.success('Appearance saved');
  };

  const toggleIntegration = async (key: string, value: boolean) => {
    const updated = { ...integrations, [key]: value };
    setIntegrations(updated);
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    if (!authUser) return;
    await supabase
      .from('app_settings')
      .update({ integrations: updated, updated_at: new Date().toISOString() })
      .eq('user_id', authUser.id);
    toast.success(`${key} ${value ? 'enabled' : 'disabled'}`);
  };

  const applyAccent = (value: string) => {
    setAccent(value);
    document.documentElement.style.setProperty('--primary', value);
    document.documentElement.style.setProperty('--ring', value);
    document.documentElement.style.setProperty('--accent', value);
  };

  if (loading || !user || dataLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Bot className="h-5 w-5 animate-pulse text-primary" />
          <span>Loading settings…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="pointer-events-none fixed inset-0 bg-grid opacity-20" />
      <div className="pointer-events-none fixed inset-0 bg-radial-glow" />
      <div className="relative mx-auto max-w-5xl px-6 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your dashboard configuration and preferences.
          </p>
        </div>

        <Tabs defaultValue="general">
          <TabsList className="flex-wrap">
            <TabsTrigger value="general" className="gap-1.5">
              <Globe className="h-3.5 w-3.5" />
              General
            </TabsTrigger>
            <TabsTrigger value="security" className="gap-1.5">
              <Shield className="h-3.5 w-3.5" />
              Security
            </TabsTrigger>
            <TabsTrigger value="notifications" className="gap-1.5">
              <Bell className="h-3.5 w-3.5" />
              Notifications
            </TabsTrigger>
            <TabsTrigger value="appearance" className="gap-1.5">
              <Palette className="h-3.5 w-3.5" />
              Appearance
            </TabsTrigger>
            <TabsTrigger value="integrations" className="gap-1.5">
              <Plug className="h-3.5 w-3.5" />
              Integrations
            </TabsTrigger>
            <TabsTrigger value="danger" className="gap-1.5 text-destructive">
              <Trash2 className="h-3.5 w-3.5" />
              Danger Zone
            </TabsTrigger>
          </TabsList>

          {/* General */}
          <TabsContent value="general" className="mt-6">
            <Card className="glass">
              <CardHeader>
                <CardTitle className="text-base">General</CardTitle>
                <CardDescription>Basic application configuration.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={generalForm.handleSubmit(saveGeneral)} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="app_name">Application name</Label>
                    <Input id="app_name" {...generalForm.register('app_name')} />
                    {generalForm.formState.errors.app_name && (
                      <p className="text-xs text-destructive">{generalForm.formState.errors.app_name.message}</p>
                    )}
                  </div>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="timezone">Timezone</Label>
                      <Select
                        value={generalForm.watch('timezone')}
                        onValueChange={(v) => generalForm.setValue('timezone', v)}
                      >
                        <SelectTrigger id="timezone">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TIMEZONES.map((tz) => (
                            <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="locale">Locale</Label>
                      <Select
                        value={generalForm.watch('locale')}
                        onValueChange={(v) => generalForm.setValue('locale', v)}
                      >
                        <SelectTrigger id="locale">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {LOCALES.map((l) => (
                            <SelectItem key={l} value={l}>{l}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Button type="submit" className="gap-2">
                    <Save className="h-4 w-4" />
                    Save changes
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Security */}
          <TabsContent value="security" className="mt-6">
            <Card className="glass">
              <CardHeader>
                <CardTitle className="text-base">Security</CardTitle>
                <CardDescription>Authentication and password policies.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={securityForm.handleSubmit(saveSecurity)} className="space-y-5">
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="session_timeout_minutes">Session timeout (minutes)</Label>
                      <Input
                        id="session_timeout_minutes"
                        type="number"
                        {...securityForm.register('session_timeout_minutes')}
                      />
                      {securityForm.formState.errors.session_timeout_minutes && (
                        <p className="text-xs text-destructive">
                          {securityForm.formState.errors.session_timeout_minutes.message}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="password_min_length">Minimum password length</Label>
                      <Input
                        id="password_min_length"
                        type="number"
                        {...securityForm.register('password_min_length')}
                      />
                      {securityForm.formState.errors.password_min_length && (
                        <p className="text-xs text-destructive">
                          {securityForm.formState.errors.password_min_length.message}
                        </p>
                      )}
                    </div>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between rounded-lg border border-border/60 bg-background-elevated/40 p-4">
                    <div>
                      <Label htmlFor="two_factor" className="text-sm font-medium">
                        Two-factor authentication
                      </Label>
                      <p className="text-xs text-muted-foreground">Require 2FA for all staff accounts.</p>
                    </div>
                    <Switch
                      id="two_factor"
                      checked={securityForm.watch('two_factor')}
                      onCheckedChange={(v) => securityForm.setValue('two_factor', v)}
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-border/60 bg-background-elevated/40 p-4">
                    <div>
                      <Label htmlFor="password_require_special" className="text-sm font-medium">
                        Require special characters
                      </Label>
                      <p className="text-xs text-muted-foreground">Passwords must include a symbol.</p>
                    </div>
                    <Switch
                      id="password_require_special"
                      checked={securityForm.watch('password_require_special')}
                      onCheckedChange={(v) => securityForm.setValue('password_require_special', v)}
                    />
                  </div>
                  <Button type="submit" className="gap-2">
                    <Save className="h-4 w-4" />
                    Save changes
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notifications */}
          <TabsContent value="notifications" className="mt-6">
            <Card className="glass">
              <CardHeader>
                <CardTitle className="text-base">Notifications</CardTitle>
                <CardDescription>Delivery channels and alert categories.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <p className="text-sm text-muted-foreground">
                  Notification preferences are managed from the bell icon in the navbar.
                  Click the gear icon in the notification panel to configure delivery
                  channels (in-app, email, webhook) and per-category toggles.
                </p>
                <Button variant="outline" onClick={() => toast.info('Open the bell icon in the navbar to configure.')}>
                  <Bell className="mr-2 h-4 w-4" />
                  Open notification preferences
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Appearance */}
          <TabsContent value="appearance" className="mt-6">
            <Card className="glass">
              <CardHeader>
                <CardTitle className="text-base">Appearance</CardTitle>
                <CardDescription>Theme and accent color.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Theme</Label>
                  <div className="mt-3 grid grid-cols-3 gap-3">
                    {[
                      { key: 'light', label: 'Light', icon: Sun },
                      { key: 'dark', label: 'Dark', icon: Moon },
                      { key: 'system', label: 'System', icon: Monitor },
                    ].map((opt) => {
                      const Icon = opt.icon;
                      const active = theme === opt.key;
                      return (
                        <button
                          key={opt.key}
                          type="button"
                          onClick={() => {
                            setTheme(opt.key);
                            saveAppearance(opt.key, accent);
                          }}
                          className={cn(
                            'flex flex-col items-center gap-2 rounded-lg border p-4 transition-all',
                            active
                              ? 'border-primary bg-primary/10 text-primary'
                              : 'border-border/60 bg-background-elevated/40 text-muted-foreground hover:text-foreground'
                          )}
                        >
                          <Icon className="h-5 w-5" />
                          <span className="text-sm font-medium">{opt.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <Separator />
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Accent color</Label>
                  <div className="mt-3 flex flex-wrap gap-3">
                    {ACCENTS.map((a) => (
                      <button
                        key={a.value}
                        type="button"
                        onClick={() => {
                          applyAccent(a.value);
                          saveAppearance(theme || 'dark', a.value);
                        }}
                        className={cn(
                          'flex items-center gap-2 rounded-lg border px-4 py-2.5 transition-all',
                          accent === a.value
                            ? 'border-primary bg-primary/10'
                            : 'border-border/60 bg-background-elevated/40 hover:border-border'
                        )}
                      >
                        <span
                          className="h-4 w-4 rounded-full"
                          style={{ background: `hsl(${a.value})` }}
                        />
                        <span className="text-sm font-medium text-foreground">{a.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Integrations */}
          <TabsContent value="integrations" className="mt-6">
            <Card className="glass">
              <CardHeader>
                <CardTitle className="text-base">Integrations</CardTitle>
                <CardDescription>Connected services and APIs.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {INTEGRATIONS.map((int) => (
                  <div
                    key={int.key}
                    className="flex items-center justify-between rounded-lg border border-border/60 bg-background-elevated/40 p-4"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          'flex h-10 w-10 items-center justify-center rounded-lg',
                          integrations[int.key]
                            ? 'bg-success/10 text-success'
                            : 'bg-muted text-muted-foreground'
                        )}
                      >
                        <Plug className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-foreground">{int.label}</div>
                        <div className="text-xs text-muted-foreground">{int.description}</div>
                      </div>
                    </div>
                    <Switch
                      checked={integrations[int.key] ?? false}
                      onCheckedChange={(v) => toggleIntegration(int.key, v)}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Danger Zone */}
          <TabsContent value="danger" className="mt-6">
            <Card className="border-destructive/30 glass">
              <CardHeader>
                <CardTitle className="text-base text-destructive">Danger Zone</CardTitle>
                <CardDescription>Irreversible and destructive actions.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                  <div>
                    <div className="text-sm font-medium text-foreground">Reset all settings</div>
                    <div className="text-xs text-muted-foreground">
                      Restore all settings to their defaults. This cannot be undone.
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    className="border-destructive/30 text-destructive hover:bg-destructive/10"
                    onClick={() => setDangerOpen(true)}
                  >
                    Reset
                  </Button>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                  <div>
                    <div className="text-sm font-medium text-foreground">Sign out everywhere</div>
                    <div className="text-xs text-muted-foreground">
                      End all active sessions for your account.
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    className="border-destructive/30 text-destructive hover:bg-destructive/10"
                    onClick={async () => {
                      await supabase.auth.signOut();
                      router.push('/');
                    }}
                  >
                    Sign out
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <AlertDialog open={dangerOpen} onOpenChange={setDangerOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset all settings?</AlertDialogTitle>
            <AlertDialogDescription>
              This will restore all settings (general, security, appearance, integrations) to their defaults. Your data and notifications will not be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                const {
                  data: { user: authUser },
                } = await supabase.auth.getUser();
                if (!authUser) return;
                const defaults = {
                  general: { app_name: 'POW Bot Dashboard', timezone: 'UTC', locale: 'en-US' },
                  security: { session_timeout_minutes: 60, two_factor: false, password_min_length: 12, password_require_special: true },
                  appearance: { theme: 'dark', accent: '199 89% 52%' },
                  integrations: Object.fromEntries(INTEGRATIONS.map((i) => [i.key, i.key === 'discord'])),
                  updated_at: new Date().toISOString(),
                };
                await supabase.from('app_settings').update(defaults).eq('user_id', authUser.id);
                generalForm.reset(defaults.general);
                securityForm.reset(defaults.security);
                setIntegrations(defaults.integrations);
                applyAccent(defaults.appearance.accent);
                setTheme('dark');
                setDangerOpen(false);
                toast.success('Settings reset to defaults');
              }}
            >
              Reset
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

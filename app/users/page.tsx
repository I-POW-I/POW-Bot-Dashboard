'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import {
  Bot,
  CheckCircle2,
  Clock,
  MoreHorizontal,
  Search,
  Shield,
  ShieldCheck,
  Trash2,
  UserPlus,
  UserX,
  Users as UsersIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/components/providers/auth-provider';
import { supabase } from '@/lib/supabase';
import { isAppAdmin } from '@/lib/auth';
import { relativeTime } from '@/lib/data';
import type { AppRole, AppUser, AppUserStatus, Invitation } from '@/types';
import { APP_ROLE_LABELS } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

const inviteSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  role: z.enum(['admin', 'editor', 'viewer']),
});
type InviteForm = z.infer<typeof inviteSchema>;

const ROLE_ORDER: AppRole[] = ['super_admin', 'admin', 'editor', 'viewer'];

const PERMISSION_FEATURES = [
  { key: 'voice', label: '24/7 Voice' },
  { key: 'logging', label: 'Log Channels' },
  { key: 'welcome', label: 'Welcome & Verify' },
  { key: 'streamers', label: 'Streamer Alerts' },
  { key: 'games', label: 'Game Alerts' },
  { key: 'leaderboard', label: 'VC Leaderboard' },
  { key: 'audit', label: 'Audit Log' },
  { key: 'users', label: 'User Management' },
  { key: 'settings', label: 'Settings' },
  { key: 'owner', label: 'Owner Panel' },
];

const STATUS_META: Record<AppUserStatus, { label: string; className: string }> = {
  active: { label: 'Active', className: 'border-success/30 bg-success/10 text-success' },
  suspended: { label: 'Suspended', className: 'border-warning/30 bg-warning/10 text-warning' },
  pending: { label: 'Pending', className: 'border-muted bg-muted text-muted-foreground' },
};

export default function UsersPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<AppRole | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<AppUserStatus | 'all'>('all');
  const [dataLoading, setDataLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AppUser | null>(null);
  const [permissions, setPermissions] = useState<Record<AppRole, Record<string, boolean>>>({
    super_admin: Object.fromEntries(PERMISSION_FEATURES.map((f) => [f.key, true])),
    admin: Object.fromEntries(PERMISSION_FEATURES.map((f) => [f.key, f.key !== 'owner' && f.key !== 'settings'])),
    editor: Object.fromEntries(PERMISSION_FEATURES.map((f) => [f.key, ['voice', 'logging', 'welcome', 'streamers', 'games', 'leaderboard'].includes(f.key)])),
    viewer: Object.fromEntries(PERMISSION_FEATURES.map((f) => [f.key, false])),
  });

  const canManage = isAppAdmin(user?.appRole);

  const form = useForm<InviteForm>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { email: '', role: 'viewer' },
  });

  const fetchUsers = useCallback(async () => {
    const { data, error } = await supabase
      .from('app_users')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      toast.error('Failed to load users', { description: error.message });
      return;
    }
    setUsers((data || []) as AppUser[]);
  }, []);

  const fetchInvitations = useCallback(async () => {
    const { data, error } = await supabase
      .from('invitations')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) return;
    setInvitations((data || []) as Invitation[]);
  }, []);

  useEffect(() => {
    if (!loading && !user) router.replace('/');
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      await Promise.all([fetchUsers(), fetchInvitations()]);
      setDataLoading(false);
    })();
  }, [user, fetchUsers, fetchInvitations]);

  const filtered = useMemo(() => {
    return users.filter((u) => {
      const matchesQuery =
        !query ||
        (u.full_name || '').toLowerCase().includes(query.toLowerCase()) ||
        u.email.toLowerCase().includes(query.toLowerCase());
      const matchesRole = roleFilter === 'all' || u.role === roleFilter;
      const matchesStatus = statusFilter === 'all' || u.status === statusFilter;
      return matchesQuery && matchesRole && matchesStatus;
    });
  }, [users, query, roleFilter, statusFilter]);

  const updateRole = async (userId: string, role: AppRole) => {
    const optimistic = users.map((u) => (u.id === userId ? { ...u, role } : u));
    setUsers(optimistic);
    const { error } = await supabase
      .from('app_users')
      .update({ role, updated_at: new Date().toISOString() })
      .eq('id', userId);
    if (error) {
      toast.error('Failed to update role', { description: error.message });
      fetchUsers();
    } else {
      toast.success(`Role updated to ${APP_ROLE_LABELS[role]}`);
    }
  };

  const updateStatus = async (userId: string, status: AppUserStatus) => {
    const optimistic = users.map((u) => (u.id === userId ? { ...u, status } : u));
    setUsers(optimistic);
    const { error } = await supabase
      .from('app_users')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', userId);
    if (error) {
      toast.error('Failed to update status', { description: error.message });
      fetchUsers();
    } else {
      toast.success(`User ${status === 'suspended' ? 'suspended' : 'reactivated'}`);
    }
  };

  const deleteUser = async (userId: string) => {
    const optimistic = users.filter((u) => u.id !== userId);
    setUsers(optimistic);
    setDeleteTarget(null);
    const { error } = await supabase.from('app_users').delete().eq('id', userId);
    if (error) {
      toast.error('Failed to delete user', { description: error.message });
      fetchUsers();
    } else {
      toast.success('User deleted');
    }
  };

  const onInvite = async (values: InviteForm) => {
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    if (!authUser) return;
    const { error } = await supabase.from('invitations').insert({
      email: values.email,
      role: values.role,
      invited_by: authUser.id,
      status: 'pending',
      expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
    });
    if (error) {
      toast.error('Failed to send invitation', { description: error.message });
      return;
    }
    toast.success(`Invitation sent to ${values.email}`);
    form.reset({ email: '', role: 'viewer' });
    setInviteOpen(false);
    fetchInvitations();
  };

  const togglePermission = (role: AppRole, feature: string, value: boolean) => {
    setPermissions((prev) => ({
      ...prev,
      [role]: { ...prev[role], [feature]: value },
    }));
    toast.success(`${APP_ROLE_LABELS[role]} — ${feature} ${value ? 'enabled' : 'disabled'}`);
  };

  if (loading || !user || dataLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Bot className="h-5 w-5 animate-pulse text-primary" />
          <span>Loading users…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="pointer-events-none fixed inset-0 bg-grid opacity-20" />
      <div className="pointer-events-none fixed inset-0 bg-radial-glow" />
      <div className="relative mx-auto max-w-7xl px-6 py-10">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              User Management
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage staff roles, invitations, and permissions.
            </p>
          </div>
          {canManage && (
            <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <UserPlus className="h-4 w-4" />
                  Invite user
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Invite a new user</DialogTitle>
                  <DialogDescription>
                    They will receive an email invitation with the selected role.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={form.handleSubmit(onInvite)} className="space-y-4 py-2">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email address</Label>
                    <Input id="email" placeholder="user@example.com" {...form.register('email')} />
                    {form.formState.errors.email && (
                      <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="role">Role</Label>
                    <Select
                      value={form.watch('role')}
                      onValueChange={(v) => form.setValue('role', v as InviteForm['role'])}
                    >
                      <SelectTrigger id="role">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="editor">Editor</SelectItem>
                        <SelectItem value="viewer">Viewer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <DialogFooter>
                    <Button type="submit" className="gap-2">
                      <UserPlus className="h-4 w-4" />
                      Send invitation
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        <Tabs defaultValue="users">
          <TabsList>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="invitations">Invitations</TabsTrigger>
            <TabsTrigger value="permissions">Permissions</TabsTrigger>
          </TabsList>

          {/* Users tab */}
          <TabsContent value="users" className="mt-6">
            <Card className="glass">
              <CardHeader>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle className="text-base">Staff directory</CardTitle>
                    <CardDescription>{filtered.length} user(s)</CardDescription>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Search…"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        className="h-9 w-48 pl-9"
                      />
                    </div>
                    <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as AppRole | 'all')}>
                      <SelectTrigger className="h-9 w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All roles</SelectItem>
                        {ROLE_ORDER.map((r) => (
                          <SelectItem key={r} value={r}>{APP_ROLE_LABELS[r]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as AppUserStatus | 'all')}>
                      <SelectTrigger className="h-9 w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All status</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="suspended">Suspended</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Last active</TableHead>
                      {canManage && <TableHead className="w-12" />}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                          <UsersIcon className="mx-auto mb-2 h-6 w-6" />
                          No users match the filters.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filtered.map((u) => (
                        <TableRow key={u.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="h-9 w-9 border border-border/60">
                                <AvatarImage src={u.avatar_url || undefined} alt={u.full_name || u.email} />
                                <AvatarFallback>
                                  {(u.full_name || u.email)[0]?.toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <div className="truncate text-sm font-medium text-foreground">
                                  {u.full_name || u.email}
                                </div>
                                <div className="truncate text-xs text-muted-foreground">{u.email}</div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            {canManage && u.role !== 'super_admin' ? (
                              <Select value={u.role} onValueChange={(v) => updateRole(u.id, v as AppRole)}>
                                <SelectTrigger className="h-8 w-32">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {ROLE_ORDER.filter((r) => r !== 'super_admin').map((r) => (
                                    <SelectItem key={r} value={r}>{APP_ROLE_LABELS[r]}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <Badge
                                variant="outline"
                                className={cn(
                                  u.role === 'super_admin' && 'border-chart-4/30 bg-chart-4/10 text-chart-4',
                                  u.role === 'admin' && 'border-primary/30 bg-primary/10 text-primary',
                                  u.role === 'editor' && 'border-chart-3/30 bg-chart-3/10 text-chart-3',
                                  u.role === 'viewer' && 'text-muted-foreground'
                                )}
                              >
                                {APP_ROLE_LABELS[u.role]}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={STATUS_META[u.status].className}>
                              {STATUS_META[u.status].label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            <div className="flex items-center gap-1.5">
                              <Clock className="h-3 w-3" />
                              {relativeTime(u.last_active_at)}
                            </div>
                          </TableCell>
                          {canManage && (
                            <TableCell>
                              {u.role !== 'super_admin' && (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                    {u.status === 'active' ? (
                                      <DropdownMenuItem onClick={() => updateStatus(u.id, 'suspended')}>
                                        <UserX className="mr-2 h-3.5 w-3.5" />
                                        Suspend
                                      </DropdownMenuItem>
                                    ) : (
                                      <DropdownMenuItem onClick={() => updateStatus(u.id, 'active')}>
                                        <CheckCircle2 className="mr-2 h-3.5 w-3.5" />
                                        Reactivate
                                      </DropdownMenuItem>
                                    )}
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      className="text-destructive"
                                      onClick={() => setDeleteTarget(u)}
                                    >
                                      <Trash2 className="mr-2 h-3.5 w-3.5" />
                                      Delete
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              )}
                            </TableCell>
                          )}
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Invitations tab */}
          <TabsContent value="invitations" className="mt-6">
            <Card className="glass">
              <CardHeader>
                <CardTitle className="text-base">Pending invitations</CardTitle>
                <CardDescription>{invitations.length} invitation(s)</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Expires</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invitations.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                          No invitations sent.
                        </TableCell>
                      </TableRow>
                    ) : (
                      invitations.map((inv) => (
                        <TableRow key={inv.id}>
                          <TableCell className="text-sm font-medium text-foreground">{inv.email}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-muted-foreground">
                              {APP_ROLE_LABELS[inv.role]}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={cn(
                                inv.status === 'pending' && 'border-warning/30 bg-warning/10 text-warning',
                                inv.status === 'accepted' && 'border-success/30 bg-success/10 text-success',
                                inv.status === 'revoked' && 'text-muted-foreground'
                              )}
                            >
                              {inv.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {relativeTime(inv.expires_at)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Permissions matrix tab */}
          <TabsContent value="permissions" className="mt-6">
            <Card className="glass">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-chart-4" />
                  <div>
                    <CardTitle className="text-base">Permissions matrix</CardTitle>
                    <CardDescription>
                      Toggle which features each app role can access.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Feature</TableHead>
                        {ROLE_ORDER.map((r) => (
                          <TableHead key={r} className="text-center">
                            {APP_ROLE_LABELS[r]}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {PERMISSION_FEATURES.map((feature) => (
                        <TableRow key={feature.key}>
                          <TableCell className="text-sm font-medium text-foreground">
                            {feature.label}
                          </TableCell>
                          {ROLE_ORDER.map((role) => (
                            <TableCell key={role} className="text-center">
                              <div className="flex justify-center">
                                <Switch
                                  checked={permissions[role][feature.key]}
                                  onCheckedChange={(v) => togglePermission(role, feature.key, v)}
                                  disabled={role === 'super_admin' || !canManage}
                                />
                              </div>
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="mt-4 flex items-center gap-2 rounded-lg border border-border/60 bg-background-elevated/40 p-3 text-xs text-muted-foreground">
                  <ShieldCheck className="h-4 w-4 text-chart-4" />
                  Super Admin always has full access and cannot be restricted.
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete user?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove {deleteTarget?.full_name || deleteTarget?.email} from the staff directory. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteUser(deleteTarget.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

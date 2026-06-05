import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Loader2, Mail, Send, Zap, Plus, Trash2, Pencil, Sun, Moon, Shield, Info, SlidersHorizontal } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { useState, useEffect } from 'react';
import { smtpApi, sparkClusterApi, apiErrorMessage } from '@/api/client';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import type { SaveSmtpConfigRequest, SparkClusterConfig, SparkClusterRequest } from '@/types';
import { useThemeStore, type Theme } from '@/hooks/useThemeStore';
import { cn } from '@/lib/utils';

export function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Application configuration</p>
      </div>

      <Tabs defaultValue="general">
        <div className="overflow-x-auto pb-1 -mx-1 px-1">
          <TabsList className="inline-flex w-max min-w-full bg-muted/50 h-auto flex-wrap sm:flex-nowrap">
            <TabsTrigger value="general">
              <SlidersHorizontal className="mr-1.5 h-4 w-4" /> General
            </TabsTrigger>
            <TabsTrigger value="spark">
              <Zap className="mr-1.5 h-4 w-4 text-amber-500" /> Spark
            </TabsTrigger>
            <TabsTrigger value="notifications">
              <Mail className="mr-1.5 h-4 w-4 text-blue-400" /> Notifications
            </TabsTrigger>
            <TabsTrigger value="security">
              <Shield className="mr-1.5 h-4 w-4" /> Security
            </TabsTrigger>
            <TabsTrigger value="about">
              <Info className="mr-1.5 h-4 w-4" /> About
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="general" className="mt-4 space-y-6">
          <AppearanceCard />
          <ApplicationInfoCard />
        </TabsContent>

        <TabsContent value="spark" className="mt-4">
          <SparkClustersCard />
        </TabsContent>

        <TabsContent value="notifications" className="mt-4">
          <SmtpConfigCard />
        </TabsContent>

        <TabsContent value="security" className="mt-4">
          <AuthenticationCard />
        </TabsContent>

        <TabsContent value="about" className="mt-4">
          <UpcomingFeaturesCard />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ApplicationInfoCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Application Info</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-between">
          <span className="text-sm text-muted-foreground">Version</span>
          <Badge variant="outline">1.0.0-SNAPSHOT</Badge>
        </div>
        <Separator />
        <div className="flex justify-between">
          <span className="text-sm text-muted-foreground">Backend</span>
          <span className="text-sm">Quarkus + Java 21</span>
        </div>
        <Separator />
        <div className="flex justify-between">
          <span className="text-sm text-muted-foreground">Frontend</span>
          <span className="text-sm">React + TypeScript + Vite</span>
        </div>
        <Separator />
        <div className="flex justify-between">
          <span className="text-sm text-muted-foreground">Maintenance Executor</span>
          <span className="flex gap-1.5"><Badge variant="secondary">Java API</Badge><Badge variant="secondary">Spark</Badge></span>
        </div>
      </CardContent>
    </Card>
  );
}

function AuthenticationCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Authentication</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex justify-between items-center">
          <div>
            <p className="font-medium">OIDC / Keycloak</p>
            <p className="text-sm text-muted-foreground">
              Enable OIDC authentication for production use
            </p>
          </div>
          <Badge variant="outline">Disabled</Badge>
        </div>
      </CardContent>
    </Card>
  );
}

function UpcomingFeaturesCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Upcoming Features (V2)</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>Nessie / Spark SQL / Trino executor support</li>
          <li>Rewrite data files & manifests</li>
          <li>Remove orphan files</li>
          <li>Table health scoring & auto-detection</li>
          <li>OIDC/Keycloak integration</li>
          <li>Role-based access control</li>
          <li>Branch/tag management</li>
          <li>Metadata lineage visualization</li>
        </ul>
      </CardContent>
    </Card>
  );
}

function AppearanceCard() {
  const { theme, setTheme } = useThemeStore();

  const options: { value: Theme; label: string; icon: typeof Sun; description: string }[] = [
    { value: 'light', label: 'Light', icon: Sun, description: 'Bright background, dark text' },
    { value: 'dark', label: 'Dark', icon: Moon, description: 'Dark background, light text' },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Appearance</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-4">
          Choose how IceGuard looks on your device. Your preference is saved automatically.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {options.map(({ value, label, icon: Icon, description }) => (
            <button
              key={value}
              type="button"
              onClick={() => setTheme(value)}
              className={cn(
                'flex items-start gap-3 rounded-lg border p-4 text-left transition-all',
                theme === value
                  ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                  : 'border-border/60 hover:bg-accent',
              )}
            >
              <div className={cn(
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
                theme === value ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
              )}>
                <Icon className="h-4 w-4" />
              </div>
              <div>
                <p className="font-medium">{label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
              </div>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function SmtpConfigCard() {
  const queryClient = useQueryClient();
  const { data: config, isLoading } = useQuery({
    queryKey: ['smtp-config'],
    queryFn: smtpApi.get,
  });

  const [form, setForm] = useState<SaveSmtpConfigRequest>({
    host: '',
    port: 587,
    username: '',
    password: '',
    fromAddress: '',
    tls: true,
    enabled: false,
  });

  useEffect(() => {
    if (config) {
      setForm({
        host: config.host,
        port: config.port,
        username: config.username,
        password: '',
        fromAddress: config.fromAddress,
        tls: config.tls,
        enabled: config.enabled,
      });
    }
  }, [config]);

  const saveMutation = useMutation({
    mutationFn: (data: SaveSmtpConfigRequest) => smtpApi.save(data),
    onSuccess: () => {
      toast.success('SMTP configuration saved');
      queryClient.invalidateQueries({ queryKey: ['smtp-config'] });
    },
    onError: (err: Error) => toast.error(`Failed to save SMTP config: ${err.message}`),
  });

  const testMutation = useMutation({
    mutationFn: () => smtpApi.test(),
    onSuccess: (result) => {
      if (result.success) {
        toast.success(result.message || 'Test email sent successfully');
      } else {
        toast.error(result.message || 'Test failed');
      }
    },
    onError: (err: Error) => toast.error(`SMTP test failed: ${err.message}`),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate(form);
  };

  const updateField = <K extends keyof SaveSmtpConfigRequest>(
    key: K,
    value: SaveSmtpConfigRequest[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" /> SMTP Configuration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5 text-blue-400" /> SMTP Configuration
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="smtp-host">Host</Label>
              <Input
                id="smtp-host"
                placeholder="smtp.example.com"
                value={form.host}
                onChange={(e) => updateField('host', e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="smtp-port">Port</Label>
              <Input
                id="smtp-port"
                type="number"
                placeholder="587"
                value={form.port}
                onChange={(e) => updateField('port', Number(e.target.value))}
                required
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="smtp-username">Username</Label>
              <Input
                id="smtp-username"
                placeholder="user@example.com"
                value={form.username}
                onChange={(e) => updateField('username', e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="smtp-password">Password</Label>
              <Input
                id="smtp-password"
                type="password"
                placeholder={config?.id ? '(unchanged)' : 'Enter password'}
                value={form.password}
                onChange={(e) => updateField('password', e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="smtp-from">From Address</Label>
            <Input
              id="smtp-from"
              type="email"
              placeholder="noreply@example.com"
              value={form.fromAddress}
              onChange={(e) => updateField('fromAddress', e.target.value)}
              required
            />
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Switch
                id="smtp-tls"
                checked={form.tls}
                onCheckedChange={(checked) => updateField('tls', checked === true)}
              />
              <Label htmlFor="smtp-tls">TLS</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="smtp-enabled"
                checked={form.enabled}
                onCheckedChange={(checked) => updateField('enabled', checked === true)}
              />
              <Label htmlFor="smtp-enabled">Enabled</Label>
            </div>
          </div>

          {config?.updatedAt && (
            <p className="text-xs text-muted-foreground">
              Last updated: {new Date(config.updatedAt).toLocaleString()}
            </p>
          )}

          <div className="flex items-center gap-3 pt-4">
            <Button type="submit" disabled={saveMutation.isPending} className="gradient-primary text-white px-6">
              {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={testMutation.isPending || !config?.id}
              onClick={() => testMutation.mutate()}
            >
              {testMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              Test Connection
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

const EMPTY_CLUSTER: SparkClusterRequest = { name: '', masterUrl: '', description: '', properties: {} };

function SparkClustersCard() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<SparkClusterRequest>(EMPTY_CLUSTER);
  const [propsText, setPropsText] = useState('');

  const { data: clusters, isLoading } = useQuery({
    queryKey: ['spark-clusters'],
    queryFn: sparkClusterApi.list,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['spark-clusters'] });

  const saveMutation = useMutation({
    mutationFn: (data: SparkClusterRequest) =>
      editId != null ? sparkClusterApi.update(editId, data) : sparkClusterApi.create(data),
    onSuccess: () => {
      toast.success(editId != null ? 'Cluster updated' : 'Cluster added');
      invalidate();
      setOpen(false);
    },
    onError: (err) => toast.error(`Failed: ${apiErrorMessage(err)}`),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => sparkClusterApi.delete(id),
    onSuccess: () => { toast.success('Cluster deleted'); invalidate(); },
    onError: (err) => toast.error(`Failed: ${apiErrorMessage(err)}`),
  });

  const openCreate = () => { setEditId(null); setForm(EMPTY_CLUSTER); setPropsText(''); setOpen(true); };
  const openEdit = (c: SparkClusterConfig) => {
    setEditId(c.id);
    setForm({ name: c.name, masterUrl: c.masterUrl, description: c.description ?? '', properties: c.properties });
    setPropsText(c.properties && Object.keys(c.properties).length ? JSON.stringify(c.properties, null, 2) : '');
    setOpen(true);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    let properties: Record<string, string> = {};
    if (propsText.trim()) {
      try { properties = JSON.parse(propsText); }
      catch { toast.error('Spark config must be valid JSON'); return; }
    }
    if (!form.name.trim() || !form.masterUrl.trim()) { toast.error('Name and master URL are required'); return; }
    saveMutation.mutate({ ...form, properties });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2"><Zap className="h-5 w-5 text-amber-400" /> Spark Clusters</span>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" onClick={openCreate}><Plus className="mr-1 h-4 w-4" /> Add Cluster</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editId != null ? 'Edit' : 'Add'} Spark Cluster</DialogTitle></DialogHeader>
              <form onSubmit={submit} className="space-y-4">
                <div className="space-y-2"><Label>Name</Label>
                  <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="prod-cluster" required />
                </div>
                <div className="space-y-2"><Label>Master URL</Label>
                  <Input value={form.masterUrl} onChange={(e) => setForm((f) => ({ ...f, masterUrl: e.target.value }))} placeholder="spark://host:7077  ·  yarn  ·  k8s://..." required />
                </div>
                <div className="space-y-2"><Label>Description <span className="text-muted-foreground">(optional)</span></Label>
                  <Input value={form.description ?? ''} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
                </div>
                <div className="space-y-2"><Label>Extra Spark config <span className="text-muted-foreground">(JSON, optional)</span></Label>
                  <Textarea value={propsText} onChange={(e) => setPropsText(e.target.value)} rows={4} placeholder='{ "spark.executor.memory": "2g" }' className="font-mono text-xs" />
                </div>
                <Button type="submit" disabled={saveMutation.isPending}>{saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{editId != null ? 'Save' : 'Add Cluster'}</Button>
              </form>
            </DialogContent>
          </Dialog>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-3">
          Remote Spark masters available for data-file compaction. A built-in <strong>local</strong> mode (<code>local[*]</code>) is always available without configuring a cluster.
        </p>
        {isLoading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : !clusters || clusters.length === 0 ? (
          <p className="text-sm text-muted-foreground py-3 text-center">No Spark clusters configured.</p>
        ) : (
          <div className="space-y-2">
            {clusters.map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-md border border-border/50 px-3 py-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{c.name}</span>
                    <Badge variant="secondary" className="font-mono text-xs">{c.masterUrl}</Badge>
                  </div>
                  {c.description && <p className="text-xs text-muted-foreground truncate">{c.description}</p>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="sm" title="Edit" onClick={() => openEdit(c)}><Pencil className="h-3.5 w-3.5" /></Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild><Button variant="ghost" size="sm" title="Delete"><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button></AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader><AlertDialogTitle>Delete Spark cluster</AlertDialogTitle>
                        <AlertDialogDescription>Delete cluster <strong>{c.name}</strong>?</AlertDialogDescription></AlertDialogHeader>
                      <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction variant="destructive" onClick={() => deleteMutation.mutate(c.id)}>Delete</AlertDialogAction></AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

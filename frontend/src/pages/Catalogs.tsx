import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { catalogApi } from '@/api/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Database, Plus, Trash2, Loader2, Check, AlertTriangle, Pencil } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { useCatalogStore } from '@/hooks/useCatalogStore';
import { guessCatalogType, CATALOG_TYPE_META } from '@/types';
import type { CreateCatalogRequest, CatalogConfig } from '@/types';
import { cn } from '@/lib/utils';

export function Catalogs() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CatalogConfig | null>(null);
  const { activeCatalogId, setActiveCatalog } = useCatalogStore();

  const { data: catalogs, isLoading } = useQuery({
    queryKey: ['catalogs'],
    queryFn: catalogApi.list,
  });

  const createMutation = useMutation({
    mutationFn: catalogApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['catalogs'] });
      setDialogOpen(false);
      toast.success('Catalog created successfully');
    },
    onError: (err: Error) => toast.error(`Failed to create catalog: ${err.message}`),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: CreateCatalogRequest }) => catalogApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['catalogs'] });
      setEditing(null);
      toast.success('Catalog updated');
    },
    onError: (err: Error) => toast.error(`Failed to update catalog: ${err.message}`),
  });

  const deleteMutation = useMutation({
    mutationFn: catalogApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['catalogs'] });
      toast.success('Catalog deleted');
    },
    onError: (err: Error) => toast.error(`Failed to delete: ${err.message}`),
  });

  const [testResults, setTestResults] = useState<Record<number, { success: boolean; message: string } | 'loading'>>({});
  const [deleteTarget, setDeleteTarget] = useState<CatalogConfig | null>(null);

  const testMutation = useMutation({
    mutationFn: catalogApi.testConnection,
    onMutate: (id) => {
      setTestResults((prev) => ({ ...prev, [id]: 'loading' }));
    },
    onSuccess: (result, id) => {
      setTestResults((prev) => ({
        ...prev,
        [id]: {
          success: result.success,
          message: result.success ? `OK — ${result.namespaceCount} namespace(s)` : result.message,
        },
      }));
    },
    onError: (err: Error, id) => {
      setTestResults((prev) => ({ ...prev, [id]: { success: false, message: err.message } }));
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Catalogs</h1>
          <p className="text-muted-foreground">
            Manage your Iceberg catalog connections — REST, Nessie, Polaris
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gradient-primary text-white border-0 hover:opacity-90">
              <Plus className="mr-2 h-4 w-4" /> Add Catalog
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Catalog</DialogTitle>
            </DialogHeader>
            <CatalogForm
              mode="create"
              pending={createMutation.isPending}
              onSubmit={(req) => createMutation.mutate(req)}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => { if (!o) setEditing(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Catalog</DialogTitle>
          </DialogHeader>
          {editing && (
            <CatalogForm
              mode="edit"
              initial={editing}
              pending={updateMutation.isPending}
              onSubmit={(req) => updateMutation.mutate({ id: editing.id, data: req })}
            />
          )}
        </DialogContent>
      </Dialog>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="h-20" />
              <CardContent className="h-16" />
            </Card>
          ))}
        </div>
      ) : catalogs?.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Database className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">No catalogs configured</p>
            <p className="text-muted-foreground mb-4">
              Add your first Iceberg REST catalog to get started
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {catalogs?.map((catalog) => {
            const type = guessCatalogType(catalog);
            const meta = CATALOG_TYPE_META[type];
            const isActive = catalog.id === activeCatalogId;

            return (
              <Card
                key={catalog.id}
                className={cn(
                  'group glass shadow-card cursor-default transition-all duration-200 ease-out',
                  'hover:-translate-y-1 hover:border-indigo-500/35 hover:shadow-glow hover:bg-card/90',
                  isActive && 'ring-1 ring-indigo-500/40 bg-indigo-500/[0.04]',
                  isActive && 'hover:ring-indigo-500/50',
                )}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <Database className={cn('h-5 w-5 transition-transform duration-200 group-hover:scale-110', meta.color)} />
                      <div>
                        <CardTitle className="text-base">{catalog.name}</CardTitle>
                        <p className="text-xs text-muted-foreground">{meta.label}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {isActive && (
                        <Badge variant="default" className="text-xs">
                          <Check className="mr-1 h-3 w-3" /> Active
                        </Badge>
                      )}
                      <Badge variant="outline">{catalog.authType}</Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-1 truncate font-mono">
                    {catalog.uri}
                  </p>
                  {catalog.warehouse && (
                    <p className="text-xs text-muted-foreground mb-3 truncate">
                      {catalog.warehouse}
                    </p>
                  )}
                  <div className="flex items-center gap-1 mt-2">
                    {!isActive && (
                      <button
                        className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors px-1.5 py-1"
                        onClick={() => { setActiveCatalog(catalog.id); toast.success(`Switched to ${catalog.name}`); }}
                      >
                        Use
                      </button>
                    )}
                    <button
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors px-1.5 py-1"
                      onClick={() => testMutation.mutate(catalog.id)}
                      disabled={testResults[catalog.id] === 'loading'}
                    >
                      {testResults[catalog.id] === 'loading' ? <Loader2 className="inline h-3 w-3 animate-spin mr-1" /> : null}
                      Test
                    </button>
                    <Link to={`/catalogs/${catalog.id}`} className="text-xs text-muted-foreground hover:text-foreground transition-colors px-1.5 py-1">
                      Browse
                    </Link>
                    <button
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors px-1.5 py-1"
                      onClick={() => setEditing(catalog)}
                      title="Edit catalog"
                    >
                      <Pencil className="inline h-3 w-3 mr-0.5" /> Edit
                    </button>
                    <button
                      className="text-xs text-red-400/60 hover:text-red-400 transition-colors px-1.5 py-1 ml-auto"
                      onClick={() => setDeleteTarget(catalog)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                    {(() => {
                      const res = testResults[catalog.id];
                      if (!res || res === 'loading') return null;
                      return (
                        <span className={cn('text-xs ml-1', res.success ? 'text-emerald-400' : 'text-red-400')}>
                          {res.success ? <Check className="inline h-3 w-3 mr-0.5" /> : <AlertTriangle className="inline h-3 w-3 mr-0.5" />}
                          {res.message}
                        </span>
                      );
                    })()}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Catalog</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deleteTarget?.name}&quot;? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (!deleteTarget) return;
                if (deleteTarget.id === activeCatalogId) setActiveCatalog(null);
                deleteMutation.mutate(deleteTarget.id);
                setDeleteTarget(null);
              }}
            >
              {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

type S3Mode = 'keep' | 'vended' | 'keys' | 'temporary' | 'webidentity';

function CatalogForm({ mode, initial, pending, onSubmit }: {
  mode: 'create' | 'edit';
  initial?: CatalogConfig;
  pending: boolean;
  onSubmit: (req: CreateCatalogRequest) => void;
}) {
  const [s3Mode, setS3Mode] = useState<S3Mode>(mode === 'edit' ? 'keep' : 'vended');

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const get = (k: string) => ((fd.get(k) as string) || '').trim();

    let credentials: Record<string, string> | undefined;
    if (s3Mode === 'keep') {
      credentials = undefined; // preserve existing credentials (edit)
    } else {
      const c: Record<string, string> = {};
      if (s3Mode !== 'vended') {
        if (get('s3Endpoint')) c['s3.endpoint'] = get('s3Endpoint');
        if (get('s3Region')) {
          c['s3.region'] = get('s3Region');
          c['client.region'] = get('s3Region');
        }
        if (fd.get('s3PathStyle') === 'on') c['s3.path-style-access'] = 'true';
        if (s3Mode === 'keys' || s3Mode === 'temporary') {
          if (get('s3AccessKey')) c['s3.access-key-id'] = get('s3AccessKey');
          if (get('s3SecretKey')) c['s3.secret-access-key'] = get('s3SecretKey');
          if (s3Mode === 'temporary' && get('s3SessionToken')) c['s3.session-token'] = get('s3SessionToken');
        }
        if (s3Mode === 'webidentity') {
          c['client.credentials-provider'] = 'software.amazon.awssdk.auth.credentials.WebIdentityTokenFileCredentialsProvider';
          if (get('s3RoleArn')) c['client.assume-role.arn'] = get('s3RoleArn');
        }
      }
      // 'vended' => empty map (clears any stored credentials); other modes => the built map
      credentials = c;
    }

    onSubmit({
      name: fd.get('name') as string,
      uri: fd.get('uri') as string,
      warehouse: (fd.get('warehouse') as string) || undefined,
      authType: (fd.get('authType') as CreateCatalogRequest['authType']) || 'NONE',
      credentials,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" placeholder="my-catalog" defaultValue={initial?.name} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="uri">URI</Label>
        <Input id="uri" name="uri" placeholder="http://localhost:8181" defaultValue={initial?.uri} required />
        <p className="text-xs text-muted-foreground">
          REST: http://host:8181 | Nessie: http://host:19120/iceberg |
          Polaris: http://host:8182/api/catalog/v1/warehouse-name
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="warehouse">Warehouse</Label>
        <Input id="warehouse" name="warehouse" placeholder="s3://my-bucket/warehouse" defaultValue={initial?.warehouse ?? ''} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="authType">Authentication</Label>
        <Select name="authType" defaultValue={initial?.authType ?? 'NONE'}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="NONE">None (REST Catalog, Nessie)</SelectItem>
            <SelectItem value="BEARER">Bearer Token</SelectItem>
            <SelectItem value="OAUTH2">OAuth2 (Polaris)</SelectItem>
            <SelectItem value="BASIC">Basic Auth</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* S3 / Storage credentials */}
      <div className="space-y-3 rounded-lg border border-border/60 p-3">
        <div className="space-y-2">
          <Label htmlFor="s3Mode">S3 / Storage access</Label>
          <Select value={s3Mode} onValueChange={(v) => setS3Mode(v as S3Mode)}>
            <SelectTrigger id="s3Mode">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {mode === 'edit' && <SelectItem value="keep">Keep existing</SelectItem>}
              <SelectItem value="vended">Vended by catalog / default chain</SelectItem>
              <SelectItem value="keys">Static access keys</SelectItem>
              <SelectItem value="temporary">Temporary credentials (session token)</SelectItem>
              <SelectItem value="webidentity">Web identity (IRSA / pod role)</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {s3Mode === 'keep' && 'Leave the stored S3 credentials unchanged.'}
            {s3Mode === 'vended' && 'Clear stored credentials — the catalog vends them, or the backend uses its default AWS chain.'}
            {s3Mode === 'keys' && 'Static IAM access key + secret.'}
            {s3Mode === 'temporary' && 'Short-lived STS credentials: access key + secret + session token.'}
            {s3Mode === 'webidentity' && 'Uses the pod service account web identity token (AWS_WEB_IDENTITY_TOKEN_FILE / AWS_ROLE_ARN).'}
          </p>
        </div>

        {(s3Mode === 'keys' || s3Mode === 'temporary' || s3Mode === 'webidentity') && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="s3Endpoint" className="text-xs">Endpoint <span className="text-muted-foreground">(optional)</span></Label>
                <Input id="s3Endpoint" name="s3Endpoint" placeholder="https://s3.amazonaws.com" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="s3Region" className="text-xs">Region</Label>
                <Input id="s3Region" name="s3Region" placeholder="us-east-1" />
              </div>
            </div>

            {(s3Mode === 'keys' || s3Mode === 'temporary') && (
              <>
                <div className="space-y-1">
                  <Label htmlFor="s3AccessKey" className="text-xs">Access Key ID</Label>
                  <Input id="s3AccessKey" name="s3AccessKey" autoComplete="off" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="s3SecretKey" className="text-xs">Secret Access Key</Label>
                  <Input id="s3SecretKey" name="s3SecretKey" type="password" autoComplete="new-password" />
                </div>
              </>
            )}

            {s3Mode === 'temporary' && (
              <div className="space-y-1">
                <Label htmlFor="s3SessionToken" className="text-xs">Session Token</Label>
                <Input id="s3SessionToken" name="s3SessionToken" type="password" autoComplete="off" />
              </div>
            )}

            {s3Mode === 'webidentity' && (
              <div className="space-y-1">
                <Label htmlFor="s3RoleArn" className="text-xs">Role ARN <span className="text-muted-foreground">(optional, else from env)</span></Label>
                <Input id="s3RoleArn" name="s3RoleArn" placeholder="arn:aws:iam::123456789012:role/my-role" />
              </div>
            )}

            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" name="s3PathStyle" className="rounded" />
              Path-style access (MinIO / non-AWS S3)
            </label>
          </>
        )}
        {mode === 'edit' && s3Mode !== 'keep' && (
          <p className="text-[11px] text-amber-400">Saving will overwrite the catalog's stored S3 credentials.</p>
        )}
      </div>

      <Button type="submit" disabled={pending} className="w-full">
        {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {mode === 'edit' ? 'Save changes' : 'Create'}
      </Button>
    </form>
  );
}

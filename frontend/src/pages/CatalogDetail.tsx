import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { catalogApi, namespaceApi } from '@/api/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { FolderOpen, Table2, Plus, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

export function CatalogDetail() {
  const { catalogId } = useParams<{ catalogId: string }>();
  const id = Number(catalogId);
  const [expandedNs, setExpandedNs] = useState<string | null>(null);

  const { data: catalog } = useQuery({
    queryKey: ['catalog', id],
    queryFn: () => catalogApi.get(id),
  });

  const { data: namespaces, isLoading } = useQuery({
    queryKey: ['namespaces', id],
    queryFn: () => namespaceApi.list(id),
  });

  const queryClient = useQueryClient();
  const [nsDialogOpen, setNsDialogOpen] = useState(false);
  const createNsMutation = useMutation({
    mutationFn: (namespace: string) => namespaceApi.create(id, { namespace }),
    onSuccess: () => {
      toast.success('Namespace created');
      queryClient.invalidateQueries({ queryKey: ['namespaces', id] });
      queryClient.invalidateQueries({ queryKey: ['namespaces'] });
      setNsDialogOpen(false);
    },
    onError: (err: Error) => toast.error(`Failed to create namespace: ${err.message}`),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{catalog?.name ?? 'Catalog'}</h1>
        <p className="text-muted-foreground">{catalog?.uri}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="glass shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Namespaces</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{namespaces?.length ?? 0}</div>
          </CardContent>
        </Card>
        <Card className="glass shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Auth Type</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant="outline">{catalog?.authType}</Badge>
          </CardContent>
        </Card>
        <Card className="glass shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Warehouse</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground truncate">
              {catalog?.warehouse || 'Not set'}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="glass shadow-card">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Namespaces</CardTitle>
          <Dialog open={nsDialogOpen} onOpenChange={setNsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline"><Plus className="mr-1 h-4 w-4" /> New Namespace</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create Namespace</DialogTitle></DialogHeader>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const name = (new FormData(e.currentTarget).get('ns') as string).trim();
                  if (name) createNsMutation.mutate(name);
                }}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label htmlFor="ns">Name</Label>
                  <Input id="ns" name="ns" placeholder="analytics  ·  team.subteam (nested)" required autoFocus />
                  <p className="text-xs text-muted-foreground">Use dots for nested namespaces (e.g. <code>team.reporting</code>).</p>
                </div>
                <Button type="submit" disabled={createNsMutation.isPending}>
                  {createNsMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : namespaces?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FolderOpen className="mx-auto h-8 w-8 mb-2" />
              <p>No namespaces found</p>
            </div>
          ) : (
            <div className="space-y-1">
              {namespaces?.map((ns) => (
                <NamespaceItem
                  key={ns.name}
                  catalogId={id}
                  namespace={ns.name}
                  expanded={expandedNs === ns.name}
                  onToggle={() => setExpandedNs(expandedNs === ns.name ? null : ns.name)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function NamespaceItem({
  catalogId,
  namespace,
  expanded,
  onToggle,
}: {
  catalogId: number;
  namespace: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const { data: tables, isLoading } = useQuery({
    queryKey: ['tables', catalogId, namespace],
    queryFn: () => namespaceApi.listTables(catalogId, namespace),
    enabled: expanded,
  });

  return (
    <div className="rounded-lg border">
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-3 p-3 hover:bg-accent transition-all duration-150 rounded-lg"
      >
        <FolderOpen className="h-4 w-4 text-yellow-500" />
        <span className="font-medium">{namespace}</span>
        {expanded && tables && (
          <Badge variant="secondary" className="ml-auto">
            {tables.length} table(s)
          </Badge>
        )}
      </button>
      {expanded && (
        <div className="border-t px-3 pb-3">
          <div className="flex justify-end pt-2">
            <Button size="sm" variant="outline" asChild>
              <Link to={`/catalogs/${catalogId}/namespaces/${namespace}/tables/new`}>
                <Plus className="mr-1 h-4 w-4" /> Create Table
              </Link>
            </Button>
          </div>
          {isLoading ? (
            <div className="py-2 space-y-1">
              {[1, 2].map((i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : tables?.length === 0 ? (
            <p className="py-2 text-sm text-muted-foreground">No tables</p>
          ) : (
            <div className="space-y-1 pt-2">
              {tables?.map((t) => (
                <Link
                  key={t}
                  to={`/catalogs/${catalogId}/namespaces/${namespace}/tables/${t}`}
                  className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent transition-all duration-150"
                >
                  <Table2 className="h-4 w-4 text-blue-500" />
                  {t}
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

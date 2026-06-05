import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { catalogApi } from '@/api/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CatalogForm } from '@/components/catalog/CatalogForm';
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
  const [editing, setEditing] = useState<CatalogConfig | null>(null);
  const { activeCatalogId, setActiveCatalog } = useCatalogStore();

  const { data: catalogs, isLoading } = useQuery({
    queryKey: ['catalogs'],
    queryFn: catalogApi.list,
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
        <Button asChild className="gradient-primary text-white border-0 hover:opacity-90">
          <Link to="/catalogs/new">
            <Plus className="mr-2 h-4 w-4" /> Add Catalog
          </Link>
        </Button>
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
            <Button asChild className="gradient-primary text-white border-0 hover:opacity-90">
              <Link to="/catalogs/new">
                <Plus className="mr-2 h-4 w-4" /> Add Catalog
              </Link>
            </Button>
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

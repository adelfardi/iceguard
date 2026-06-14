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
import { Input } from '@/components/ui/input';
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
import { Database, Plus, Trash2, Loader2, Check, AlertTriangle, Pencil, Tag, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { useCatalogStore } from '@/hooks/useCatalogStore';
import { guessCatalogType, CATALOG_TYPE_META } from '@/types';
import type { CreateCatalogRequest, CatalogConfig } from '@/types';
import { cn } from '@/lib/utils';
import { tagColorStyle } from '@/lib/tagColor';

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
  const [tagsTarget, setTagsTarget] = useState<CatalogConfig | null>(null);
  const [tagFilter, setTagFilter] = useState<Set<string>>(new Set());

  const setTagsMutation = useMutation({
    mutationFn: ({ id, tags }: { id: number; tags: string[] }) => catalogApi.setTags(id, tags),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['catalogs'] });
      setTagsTarget(null);
      toast.success('Tags updated');
    },
    onError: (err: Error) => toast.error(`Failed to update tags: ${err.message}`),
  });

  // Distinct tags across all catalogs (for the filter bar) + filtered list.
  const allTags = Array.from(new Set((catalogs ?? []).flatMap((c) => c.tags ?? []))).sort();
  const toggleTagFilter = (tag: string) =>
    setTagFilter((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag); else next.add(tag);
      return next;
    });
  const filteredCatalogs = (catalogs ?? []).filter(
    (c) => tagFilter.size === 0 || (c.tags ?? []).some((t) => tagFilter.has(t)),
  );

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

      {/* Tag filter bar */}
      {allTags.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1 text-xs text-muted-foreground"><Tag className="h-3.5 w-3.5" /> Filter:</span>
          {allTags.map((tag) => {
            const on = tagFilter.has(tag);
            return (
              <button key={tag} onClick={() => toggleTagFilter(tag)}>
                <Badge
                  variant="outline"
                  className={cn('cursor-pointer text-xs transition-all', on ? 'ring-1 ring-offset-1 ring-offset-background' : 'opacity-70 hover:opacity-100')}
                  style={tagColorStyle(tag)}
                >
                  {tag}
                </Badge>
              </button>
            );
          })}
          {tagFilter.size > 0 && (
            <button className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setTagFilter(new Set())}>
              Clear
            </button>
          )}
        </div>
      )}

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
          {filteredCatalogs.length === 0 ? (
            <p className="col-span-full text-center text-sm text-muted-foreground py-10">No catalogs match the selected tags.</p>
          ) : filteredCatalogs.map((catalog) => {
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
                    <p className="text-xs text-muted-foreground mb-2 truncate">
                      {catalog.warehouse}
                    </p>
                  )}
                  {/* Tags */}
                  <div className="flex flex-wrap items-center gap-1 mb-3">
                    {(catalog.tags ?? []).map((tag) => (
                      <Badge key={tag} variant="outline" className="text-[11px] font-normal" style={tagColorStyle(tag)}>{tag}</Badge>
                    ))}
                    <button
                      className="inline-flex items-center gap-0.5 rounded border border-dashed border-muted-foreground/30 px-1.5 py-0.5 text-[11px] text-muted-foreground hover:border-indigo-500/50 hover:text-foreground transition-colors"
                      onClick={() => setTagsTarget(catalog)}
                      title="Edit tags"
                    >
                      <Tag className="h-3 w-3" /> {(catalog.tags ?? []).length === 0 ? 'Add tags' : 'Edit'}
                    </button>
                  </div>
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

      <CatalogTagsDialog
        catalog={tagsTarget}
        suggestions={allTags}
        pending={setTagsMutation.isPending}
        onOpenChange={(o) => { if (!o) setTagsTarget(null); }}
        onSave={(tags) => { if (tagsTarget) setTagsMutation.mutate({ id: tagsTarget.id, tags }); }}
      />

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

function CatalogTagsDialog({ catalog, suggestions, pending, onOpenChange, onSave }: {
  catalog: CatalogConfig | null;
  suggestions: string[];
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (tags: string[]) => void;
}) {
  const [draft, setDraft] = useState<string[]>([]);
  const [input, setInput] = useState('');

  // Reset the draft whenever a different catalog is opened.
  useEffect(() => {
    if (catalog) { setDraft(catalog.tags ?? []); setInput(''); }
  }, [catalog]);

  const addTag = (raw: string) => {
    const tag = raw.trim();
    if (tag && !draft.includes(tag)) setDraft((d) => [...d, tag]);
    setInput('');
  };
  const removeTag = (tag: string) => setDraft((d) => d.filter((t) => t !== tag));

  const unusedSuggestions = suggestions.filter((s) => !draft.includes(s));

  return (
    <Dialog open={!!catalog} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tags — {catalog?.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex flex-wrap gap-1.5 min-h-8">
            {draft.length === 0 && <span className="text-sm text-muted-foreground">No tags yet.</span>}
            {draft.map((tag) => (
              <Badge key={tag} variant="outline" className="gap-1 text-xs font-normal" style={tagColorStyle(tag)}>
                {tag}
                <button onClick={() => removeTag(tag)} className="hover:opacity-70" title="Remove">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
          <Input
            placeholder="Add a tag and press Enter (e.g. prod, draft)"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); addTag(input); }
              else if (e.key === 'Backspace' && input === '' && draft.length > 0) removeTag(draft[draft.length - 1]);
            }}
          />
          {unusedSuggestions.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-muted-foreground">Existing:</span>
              {unusedSuggestions.map((s) => (
                <button key={s} onClick={() => addTag(s)}>
                  <Badge variant="outline" className="cursor-pointer text-[11px] font-normal hover:border-indigo-500/50">+ {s}</Badge>
                </button>
              ))}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={() => onSave(draft)} disabled={pending}>
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

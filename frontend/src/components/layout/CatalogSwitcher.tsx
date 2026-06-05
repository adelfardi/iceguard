import { useQuery } from '@tanstack/react-query';
import { catalogApi } from '@/api/client';
import { useCatalogStore } from '@/hooks/useCatalogStore';
import { Database, ChevronsUpDown, Check, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Link, useNavigate } from 'react-router-dom';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function CatalogSwitcher({ collapsed }: { collapsed: boolean }) {
  const { activeCatalogId, setActiveCatalog } = useCatalogStore();
  const navigate = useNavigate();

  const { data: catalogs } = useQuery({
    queryKey: ['catalogs'],
    queryFn: catalogApi.list,
  });

  const activeCatalog = catalogs?.find((c) => c.id === activeCatalogId);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            'flex w-full items-center gap-2 rounded-lg glass p-2 text-sm transition-all duration-150 hover:bg-sidebar-accent',
            collapsed ? 'justify-center' : 'justify-between',
          )}
        >
          <div className="flex items-center gap-2 min-w-0">
            <Database className="h-4 w-4 shrink-0 text-blue-500" />
            {!collapsed && (
              <span className="truncate font-medium">
                {activeCatalog?.name ?? 'Select catalog'}
              </span>
            )}
          </div>
          {!collapsed && <ChevronsUpDown className="h-3 w-3 shrink-0 text-muted-foreground" />}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={8} className="w-60">
        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
          Catalogs
        </div>
        {catalogs?.map((catalog) => (
          <DropdownMenuItem
            key={catalog.id}
            onClick={() => {
              setActiveCatalog(catalog.id);
              navigate(`/catalogs/${catalog.id}`);
            }}
            className="flex items-center gap-2 cursor-pointer"
          >
            <CatalogIcon type={guessCatalogType(catalog.name, catalog.uri)} />
            <div className="flex-1 min-w-0">
              <p className="truncate font-medium">{catalog.name}</p>
              <p className="truncate text-xs text-muted-foreground">{catalog.uri}</p>
            </div>
            {catalog.id === activeCatalogId && (
              <Check className="h-4 w-4 text-primary shrink-0" />
            )}
          </DropdownMenuItem>
        ))}
        {(!catalogs || catalogs.length === 0) && (
          <div className="px-2 py-4 text-center text-sm text-muted-foreground">
            No catalogs configured
          </div>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="cursor-pointer">
          <Link to="/catalogs" className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Manage catalogs
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function guessCatalogType(name: string, uri: string): 'nessie' | 'polaris' | 'rest' {
  const lower = (name + uri).toLowerCase();
  if (lower.includes('nessie')) return 'nessie';
  if (lower.includes('polaris')) return 'polaris';
  return 'rest';
}

function CatalogIcon({ type }: { type: 'nessie' | 'polaris' | 'rest' }) {
  const colors = {
    nessie: 'text-green-500',
    polaris: 'text-purple-500',
    rest: 'text-blue-500',
  };
  return <Database className={cn('h-4 w-4 shrink-0', colors[type])} />;
}

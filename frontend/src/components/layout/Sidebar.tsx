import { Link, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  LayoutDashboard,
  Wrench,
  GitBranch,
  Bell,
  Settings,
  ChevronLeft,
  ChevronRight,
  FolderOpen,
  Table2,
  Database,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { useCatalogStore } from '@/hooks/useCatalogStore';
import { namespaceApi, alertApi } from '@/api/client';
import { CatalogSwitcher } from './CatalogSwitcher';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/catalogs', label: 'Catalogs', icon: Database },
  { path: '/pipelines', label: 'Pipelines', icon: GitBranch },
  { path: '/alerts', label: 'Alerts', icon: Bell },
  { path: '/executions', label: 'Executions', icon: Wrench },
  { path: '/settings', label: 'Settings', icon: Settings },
];

interface SidebarProps {
  mobile?: boolean;
  onNavigate?: () => void;
}

function BrandWordmark() {
  return (
    <span className="truncate text-xl font-bold leading-none tracking-tight">
      <span className="bg-gradient-to-br from-cyan-400 via-sky-400 to-indigo-500 bg-clip-text text-transparent dark:from-cyan-300 dark:via-sky-300 dark:to-indigo-400">
        Ice
      </span>
      <span className="bg-gradient-to-br from-indigo-500 to-violet-600 bg-clip-text text-transparent dark:from-indigo-300 dark:to-violet-400">
        Guard
      </span>
    </span>
  );
}

export function Sidebar({ mobile = false, onNavigate }: SidebarProps) {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const { activeCatalogId } = useCatalogStore();
  const isCollapsed = mobile ? false : collapsed;

  const collapseButton = !mobile ? (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-sidebar-foreground/50 transition-all hover:bg-sidebar-accent hover:text-sidebar-foreground"
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </TooltipTrigger>
      <TooltipContent side="right">{isCollapsed ? 'Expand' : 'Collapse'}</TooltipContent>
    </Tooltip>
  ) : null;

  const content = (
    <>
      {/* Logo + collapse (right) */}
      <div className="flex h-14 items-center gap-1 px-2">
        {!isCollapsed ? (
          <Link
            to="/"
            className="group flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-1 py-1 transition-colors hover:bg-sidebar-accent/60"
            onClick={onNavigate}
          >
            <div className="relative shrink-0">
              <span
                className="pointer-events-none absolute inset-0 rounded-lg bg-indigo-500/25 blur-md opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                aria-hidden
              />
              <img
                src="/ice.png"
                alt="IceGuard"
                className="relative h-8 w-8 rounded-lg object-contain transition-transform duration-200 group-hover:scale-105"
              />
            </div>
            <BrandWordmark />
          </Link>
        ) : (
          <Link to="/" className="flex flex-1 justify-center" onClick={onNavigate}>
            <img src="/ice.png" alt="IceGuard" className="h-7 w-7 rounded-lg object-contain" />
          </Link>
        )}
        {collapseButton}
      </div>
      <div className="h-px bg-gradient-to-r from-transparent via-indigo-500/30 to-transparent" />

      {/* Catalog switcher */}
      <div className="px-3 py-3">
        <CatalogSwitcher collapsed={isCollapsed} />
      </div>

      <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />

      {/* Catalog tree - namespaces and tables */}
      {activeCatalogId && !isCollapsed && (
        <CatalogTree catalogId={activeCatalogId} onNavigate={onNavigate} />
      )}

      {activeCatalogId && !isCollapsed && <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />}

      {/* Navigation */}
      <NavMenu collapsed={isCollapsed} currentPath={location.pathname} onNavigate={onNavigate} />
    </>
  );

  if (mobile) {
    return (
      <TooltipProvider delayDuration={0}>
        <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
          {content}
        </div>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          'hidden md:flex flex-col bg-sidebar text-sidebar-foreground transition-all duration-200',
          isCollapsed ? 'w-16' : 'w-72',
        )}
      >
        {content}
      </aside>
    </TooltipProvider>
  );
}

function CatalogTree({ catalogId, onNavigate }: { catalogId: number; onNavigate?: () => void }) {
  const location = useLocation();
  const [expandedNs, setExpandedNs] = useState<Set<string>>(new Set());

  const { data: namespaces, isLoading } = useQuery({
    queryKey: ['namespaces', catalogId],
    queryFn: () => namespaceApi.list(catalogId),
  });

  const toggleNs = (ns: string) => {
    setExpandedNs((prev) => {
      const next = new Set(prev);
      if (next.has(ns)) next.delete(ns);
      else next.add(ns);
      return next;
    });
  };

  return (
    <ScrollArea className="flex-1 min-h-0 px-2 py-2">
      <div className="px-1 pb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        Explorer
      </div>
      {isLoading ? (
        <div className="space-y-1 p-1">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-7 w-full" />
          ))}
        </div>
      ) : namespaces?.length === 0 ? (
        <p className="px-3 py-2 text-xs text-muted-foreground">No namespaces</p>
      ) : (
        <div className="space-y-0.5">
          {namespaces?.map((ns) => (
            <NamespaceNode
              key={ns.name}
              catalogId={catalogId}
              namespace={ns.name}
              expanded={expandedNs.has(ns.name)}
              onToggle={() => toggleNs(ns.name)}
              currentPath={location.pathname}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      )}
    </ScrollArea>
  );
}

function NamespaceNode({
  catalogId,
  namespace,
  expanded,
  onToggle,
  currentPath,
  onNavigate,
}: {
  catalogId: number;
  namespace: string;
  expanded: boolean;
  onToggle: () => void;
  currentPath: string;
  onNavigate?: () => void;
}) {
  const { data: tables } = useQuery({
    queryKey: ['tables', catalogId, namespace],
    queryFn: () => namespaceApi.listTables(catalogId, namespace),
    enabled: expanded,
  });

  return (
    <div>
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-sidebar-accent transition-all duration-150"
      >
        <FolderOpen className={cn('h-3.5 w-3.5', expanded ? 'text-yellow-500' : 'text-muted-foreground')} />
        <span className="truncate flex-1 text-left">{namespace}</span>
        {tables && (
          <Badge variant="secondary" className="h-4 px-1 text-[10px]">
            {tables.length}
          </Badge>
        )}
      </button>
      {expanded && tables && (
        <div className="ml-4 space-y-0.5 border-l pl-2">
          {tables.map((table) => {
            const tablePath = `/catalogs/${catalogId}/namespaces/${namespace}/tables/${table}`;
            const isActive = currentPath === tablePath;
            return (
              <Link
                key={table}
                to={tablePath}
                onClick={onNavigate}
                className={cn(
                  'flex items-center gap-2 rounded-lg px-2 py-1 text-sm transition-all duration-150',
                  isActive
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                    : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                )}
              >
                <Table2 className="h-3.5 w-3.5 text-blue-400" />
                <span className="truncate">{table}</span>
              </Link>
            );
          })}
          {tables.length === 0 && (
            <p className="px-2 py-1 text-xs text-muted-foreground">No tables</p>
          )}
        </div>
      )}
    </div>
  );
}

function NavMenu({ collapsed, currentPath, onNavigate }: { collapsed: boolean; currentPath: string; onNavigate?: () => void }) {
  const { data: events } = useQuery({
    queryKey: ['alert-events'],
    queryFn: () => alertApi.listEvents(50),
    refetchInterval: 30_000,
  });

  const unackCount = events?.filter((e) => e.status === 'TRIGGERED').length ?? 0;

  return (
    <nav className="space-y-1 px-2 py-3">
      {navItems.map((item) => {
        const isActive =
          item.path === '/'
            ? currentPath === '/'
            : currentPath.startsWith(item.path);
        const isAlerts = item.path === '/alerts';
        const link = (
          <Link
            key={item.path}
            to={item.path}
            onClick={onNavigate}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150',
              isActive
                ? 'bg-sidebar-accent text-sidebar-accent-foreground border-l-2 border-l-indigo-500'
                : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
              collapsed && 'justify-center px-2',
            )}
          >
            <span className="relative shrink-0">
              <item.icon className="h-4 w-4" />
              {isAlerts && unackCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
                  {unackCount > 9 ? '9+' : unackCount}
                </span>
              )}
            </span>
            {!collapsed && (
              <span className="flex-1">{item.label}</span>
            )}
          </Link>
        );

        if (collapsed) {
          return (
            <Tooltip key={item.path}>
              <TooltipTrigger asChild>{link}</TooltipTrigger>
              <TooltipContent side="right">{item.label}</TooltipContent>
            </Tooltip>
          );
        }

        return link;
      })}
    </nav>
  );
}

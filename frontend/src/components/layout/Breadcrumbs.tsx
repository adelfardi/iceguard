import { Link, useLocation, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, Home } from 'lucide-react';
import { catalogApi, pipelineApi } from '@/api/client';

interface Crumb {
  path: string;
  label: string;
  /** false when no route exists (e.g. namespace has no dedicated page) */
  clickable?: boolean;
}

const STATIC_LABELS: Record<string, string> = {
  '/': 'Dashboard',
  '/catalogs': 'Catalogs',
  '/pipelines': 'Pipelines',
  '/executions': 'Executions',
  '/alerts': 'Alerts',
  '/settings': 'Settings',
};

export function Breadcrumbs() {
  const location = useLocation();
  const params = useParams();
  const catalogId = params.catalogId ? Number(params.catalogId) : null;
  const pipelineId = params.pipelineId ? Number(params.pipelineId) : null;

  const { data: catalog } = useQuery({
    queryKey: ['catalog', catalogId],
    queryFn: () => catalogApi.get(catalogId!),
    enabled: catalogId != null && !isNaN(catalogId),
  });

  const { data: pipeline } = useQuery({
    queryKey: ['pipeline', pipelineId],
    queryFn: () => pipelineApi.get(pipelineId!),
    enabled: pipelineId != null && !isNaN(pipelineId),
  });

  const crumbs = buildCrumbs(location.pathname, {
    catalogName: catalog?.name,
    namespace: params.namespace,
    table: params.table,
    pipelineName: pipeline?.name,
  });

  if (crumbs.length <= 1) return null;

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm text-muted-foreground min-w-0">
      {crumbs.map((crumb, i) => (
        <span key={crumb.path} className="flex items-center gap-1 min-w-0">
          {i > 0 && <ChevronRight className="h-3 w-3 shrink-0" />}
          {i < crumbs.length - 1 && crumb.clickable !== false ? (
            <Link
              to={crumb.path}
              className="hover:text-foreground transition-colors truncate max-w-[12rem] flex items-center gap-1"
            >
              {i === 0 && crumbs.length > 1 && <Home className="h-3 w-3 shrink-0" />}
              <span className="truncate">{crumb.label}</span>
            </Link>
          ) : i < crumbs.length - 1 ? (
            <span className="truncate max-w-[12rem] text-muted-foreground">{crumb.label}</span>
          ) : (
            <span className="text-foreground font-medium truncate max-w-[16rem]">{crumb.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

function buildCrumbs(
  pathname: string,
  ctx: {
    catalogName?: string;
    namespace?: string;
    table?: string;
    pipelineName?: string;
  },
): Crumb[] {
  const crumbs: Crumb[] = [{ path: '/', label: STATIC_LABELS['/'] }];

  if (pathname === '/') return crumbs;

  const segments = pathname.split('/').filter(Boolean);

  if (segments[0] === 'catalogs') {
    crumbs.push({ path: '/catalogs', label: STATIC_LABELS['/catalogs'] });

    if (segments[1]) {
      const catalogPath = `/catalogs/${segments[1]}`;
      crumbs.push({
        path: catalogPath,
        label: ctx.catalogName ?? `Catalog ${segments[1]}`,
      });

      if (segments[2] === 'namespaces' && segments[3]) {
        crumbs.push({
          path: `${catalogPath}/namespaces/${segments[3]}`,
          label: ctx.namespace ?? segments[3],
          clickable: false,
        });

        if (segments[4] === 'tables' && segments[5]) {
          crumbs.push({
            path: pathname,
            label: segments[5],
          });
        }
      }
    }
    return crumbs;
  }

  if (segments[0] === 'pipelines') {
    crumbs.push({ path: '/pipelines', label: STATIC_LABELS['/pipelines'] });
    if (segments[1]) {
      crumbs.push({
        path: `/pipelines/${segments[1]}`,
        label: ctx.pipelineName ?? `Pipeline ${segments[1]}`,
      });
    }
    return crumbs;
  }

  const staticPath = `/${segments[0]}`;
  if (STATIC_LABELS[staticPath]) {
    crumbs.push({ path: staticPath, label: STATIC_LABELS[staticPath] });
  }

  return crumbs;
}

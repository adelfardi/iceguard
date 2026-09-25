import { ArrowLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** Prev/next pager for a list that is already fully loaded client-side. */
export function ClientPagination({
  page, pageSize, total, onPageChange,
}: {
  page: number; pageSize: number; total: number; onPageChange: (page: number) => void;
}) {
  if (total <= pageSize) return null;
  const from = page * pageSize + 1;
  const to = Math.min(total, (page + 1) * pageSize);
  return (
    <div className="flex items-center justify-between pt-3 text-xs text-muted-foreground">
      <span>{from.toLocaleString()}–{to.toLocaleString()} of {total.toLocaleString()}</span>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="sm" className="h-7" disabled={page === 0} onClick={() => onPageChange(Math.max(0, page - 1))}>
          <ArrowLeft className="h-3.5 w-3.5" /> Prev
        </Button>
        <Button variant="outline" size="sm" className="h-7" disabled={to >= total} onClick={() => onPageChange(page + 1)}>
          Next <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

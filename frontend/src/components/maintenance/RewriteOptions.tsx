import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export type RewriteOpt = {
  key: string;
  label: string;
  kind: 'text' | 'number' | 'mb' | 'flag' | 'select';
  choices?: string[];
  placeholder?: string;
  advanced?: boolean;
  /** Honoured by the in-process Java executor (the rest are Spark-only). */
  javaSupported?: boolean;
};

const MB = 1_048_576;

// Full rewrite_data_files surface: named args (strategy/sort_order/where, handled by the backend)
// plus options-map keys. Each is opt-in via a checkbox; `advanced` ones hide behind a toggle.
export const REWRITE_OPTIONS: RewriteOpt[] = [
  { key: 'strategy', label: 'Strategy', kind: 'select', choices: ['binpack', 'sort'] },
  { key: 'sort_order', label: 'Sort order', kind: 'text', placeholder: 'created_at DESC NULLS LAST, zorder(user_id, url)' },
  { key: 'where', label: 'Filter (where)', kind: 'text', placeholder: "event_type = 'click'" },
  { key: 'target-file-size-bytes', label: 'Target file size (MB)', kind: 'mb', placeholder: '512', javaSupported: true },
  { key: 'min-input-files', label: 'Min input files', kind: 'number', placeholder: '5', javaSupported: true },
  { key: 'min-file-size-bytes', label: 'Min file size (MB)', kind: 'mb', placeholder: '128', advanced: true },
  { key: 'max-file-size-bytes', label: 'Max file size (MB)', kind: 'mb', placeholder: '1024', advanced: true },
  { key: 'max-file-group-size-bytes', label: 'Max file-group size (MB)', kind: 'mb', placeholder: '10240', advanced: true },
  { key: 'max-concurrent-file-group-rewrites', label: 'Max concurrent groups', kind: 'number', placeholder: '5', advanced: true },
  { key: 'delete-file-threshold', label: 'Delete-file threshold', kind: 'number', placeholder: '1', advanced: true },
  { key: 'rewrite-job-order', label: 'Job order', kind: 'select', choices: ['none', 'bytes-asc', 'bytes-desc', 'files-asc', 'files-desc'], advanced: true },
  { key: 'partial-progress.enabled', label: 'Partial progress', kind: 'flag', advanced: true },
  { key: 'partial-progress.max-commits', label: 'Partial-progress max commits', kind: 'number', placeholder: '10', advanced: true },
  { key: 'rewrite-all', label: 'Rewrite all files', kind: 'flag', advanced: true },
  { key: 'remove-dangling-deletes', label: 'Remove dangling deletes', kind: 'flag', advanced: true },
];

/** Drop empty (enabled-but-unset) text/number values before sending; keep flags and real values. */
export function cleanRewriteParams(params: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v !== '') out[k] = v;
  }
  return out;
}

function displayValue(o: RewriteOpt, raw: string | undefined): string {
  if (o.kind === 'mb') return raw ? String(Math.round(Number(raw) / MB)) : '';
  return raw ?? '';
}

function storedValue(o: RewriteOpt, display: string): string {
  if (o.kind === 'mb') return display ? String(Math.round(Number(display) * MB)) : '';
  return display;
}

function OptionRow({ o, params, onChange }: {
  o: RewriteOpt;
  params: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
}) {
  const on = o.key in params;
  const toggle = (checked: boolean) => {
    const next = { ...params };
    if (checked) next[o.key] = o.kind === 'flag' ? 'true' : o.kind === 'select' ? (o.choices![0]) : '';
    else delete next[o.key];
    onChange(next);
  };
  const setVal = (display: string) => onChange({ ...params, [o.key]: storedValue(o, display) });
  return (
    <div className="flex items-center gap-2 py-0.5">
      <input type="checkbox" className="h-4 w-4 shrink-0 accent-indigo-500" checked={on} onChange={(e) => toggle(e.target.checked)} />
      <Label className="w-52 shrink-0 text-xs font-normal">{o.label}</Label>
      {o.kind === 'flag' ? null : o.kind === 'select' ? (
        <Select value={params[o.key] || o.choices![0]} onValueChange={(v) => onChange({ ...params, [o.key]: v })}>
          <SelectTrigger className="h-7 text-xs" disabled={!on}><SelectValue /></SelectTrigger>
          <SelectContent>{o.choices!.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
        </Select>
      ) : (
        <Input className="h-7 text-xs" type={o.kind === 'text' ? 'text' : 'number'} placeholder={o.placeholder}
          value={displayValue(o, params[o.key])} disabled={!on} onChange={(e) => setVal(e.target.value)} />
      )}
    </div>
  );
}

/**
 * Controlled editor for the full set of rewrite_data_files options, bound to a params map
 * (the Iceberg option values — MB shown in MB, stored in bytes). Reused by the table maintenance
 * dialog and the pipeline task editor.
 */
export function RewriteOptionsEditor({ params, onChange, engine, hiddenKeys }: {
  params: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
  /** When 'java', only the options the in-process executor honours are shown. */
  engine?: 'java' | 'spark';
  /** Option keys to hide (e.g. 'where' when it is derived from a partition selection). */
  hiddenKeys?: string[];
}) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const hidden = new Set(hiddenKeys ?? []);
  const visible = (engine === 'java' ? REWRITE_OPTIONS.filter((o) => o.javaSupported) : REWRITE_OPTIONS)
    .filter((o) => !hidden.has(o.key));
  const basic = visible.filter((o) => !o.advanced);
  const advanced = visible.filter((o) => o.advanced);
  return (
    <div className="space-y-1 rounded-md border border-border/50 p-3">
      <p className="mb-1 text-xs text-muted-foreground">
        Options — tick to enable, then set a value{engine === 'java' ? ' (Java engine — only these apply)' : ''}.
      </p>
      {basic.map((o) => (
        <OptionRow key={o.key} o={o} params={params} onChange={onChange} />
      ))}
      {advanced.length > 0 && (
        <>
          <button type="button" onClick={() => setShowAdvanced((v) => !v)}
            className="mt-1 flex items-center gap-1 text-xs font-medium text-indigo-400 hover:text-indigo-300">
            <ChevronRight className={cn('h-3.5 w-3.5 transition-transform', showAdvanced && 'rotate-90')} /> Advanced
          </button>
          {showAdvanced && advanced.map((o) => (
            <OptionRow key={o.key} o={o} params={params} onChange={onChange} />
          ))}
        </>
      )}
    </div>
  );
}

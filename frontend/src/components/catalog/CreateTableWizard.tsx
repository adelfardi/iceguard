import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plus, Trash2, Loader2, Check } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { CreateTableRequest } from '@/types';

const ICEBERG_TYPES = [
  'string', 'long', 'int', 'double', 'float', 'boolean',
  'date', 'timestamp', 'timestamptz', 'decimal', 'binary', 'uuid',
] as const;

const PARTITION_TRANSFORMS = ['identity', 'year', 'month', 'day', 'hour', 'bucket', 'truncate'] as const;

const STEPS = [
  { id: 'description', label: 'Description' },
  { id: 'columns', label: 'Columns' },
  { id: 'partitions', label: 'Partitions' },
  { id: 'properties', label: 'Properties' },
] as const;

export interface ColumnDef {
  name: string;
  type: string;
  required: boolean;
  doc: string;
}

interface PartitionDraft {
  id: string;
  sourceColumn: string;
  transform: string;
  width: string;
}

interface PropertyDraft {
  id: string;
  key: string;
  value: string;
}

export interface TableWizardData {
  name: string;
  description: string;
  columns: ColumnDef[];
  partitionFields: { sourceColumn: string; transform: string }[];
  properties: Record<string, string>;
}

function emptyColumn(): ColumnDef {
  return { name: '', type: 'string', required: false, doc: '' };
}

function buildPayload(draft: {
  name: string;
  description: string;
  columns: ColumnDef[];
  partitions: PartitionDraft[];
  properties: PropertyDraft[];
}): TableWizardData | null {
  const name = draft.name.trim();
  if (!name) {
    toast.error('Table name is required');
    return null;
  }
  const validCols = draft.columns.filter((c) => c.name.trim());
  if (validCols.length === 0) {
    toast.error('At least one column with a name is required');
    return null;
  }

  const partitionFields = draft.partitions
    .filter((p) => p.sourceColumn.trim())
    .map((p) => {
      let transform = p.transform;
      if (p.transform === 'bucket' || p.transform === 'truncate') {
        const w = parseInt(p.width, 10);
        if (!w || w <= 0) {
          toast.error(`Enter a valid ${p.transform === 'bucket' ? 'bucket count' : 'truncate width'}`);
          return null;
        }
        transform = `${p.transform}[${w}]`;
      }
      return { sourceColumn: p.sourceColumn.trim(), transform };
    });

  if (partitionFields.some((p) => p === null)) return null;

  const properties: Record<string, string> = {};
  if (draft.description.trim()) properties.comment = draft.description.trim();
  for (const row of draft.properties) {
    const key = row.key.trim();
    if (key) properties[key] = row.value;
  }

  return {
    name,
    description: draft.description.trim(),
    columns: validCols,
    partitionFields: partitionFields as { sourceColumn: string; transform: string }[],
    properties,
  };
}

export function CreateTableWizard({
  isPending,
  onSubmit,
}: {
  isPending: boolean;
  onSubmit: (data: TableWizardData) => void;
}) {
  const [step, setStep] = useState(0);

  const [tableName, setTableName] = useState('');
  const [description, setDescription] = useState('');
  const [columns, setColumns] = useState<ColumnDef[]>([emptyColumn()]);
  const [partitions, setPartitions] = useState<PartitionDraft[]>([]);
  const [properties, setProperties] = useState<PropertyDraft[]>([]);

  const namedColumns = columns.filter((c) => c.name.trim());
  const canSave = tableName.trim() !== '' && namedColumns.length > 0;

  const currentStep = STEPS[step];
  const isLastStep = step === STEPS.length - 1;

  function goNext() {
    if (step === 0 && !tableName.trim()) {
      toast.error('Table name is required');
      return;
    }
    if (step === 1 && namedColumns.length === 0) {
      toast.error('At least one column with a name is required');
      return;
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function handleSkip() {
    if (isLastStep) {
      handleSave();
      return;
    }
    if (step === 0 && !tableName.trim()) {
      toast.error('Table name is required before continuing');
      return;
    }
    if (step === 1 && namedColumns.length === 0) {
      toast.error('At least one column is required before continuing');
      return;
    }
    goNext();
  }

  function handleSave() {
    const payload = buildPayload({ name: tableName, description, columns, partitions, properties });
    if (payload) onSubmit(payload);
  }

  const addColumn = () => setColumns([...columns, emptyColumn()]);
  const removeColumn = (idx: number) => setColumns(columns.filter((_, i) => i !== idx));
  const updateColumn = (idx: number, field: keyof ColumnDef, value: string | boolean) =>
    setColumns(columns.map((c, i) => (i === idx ? { ...c, [field]: value } : c)));

  const addPartition = () =>
    setPartitions([
      ...partitions,
      {
        id: crypto.randomUUID(),
        sourceColumn: namedColumns[0]?.name ?? '',
        transform: 'identity',
        width: '16',
      },
    ]);
  const removePartition = (id: string) => setPartitions(partitions.filter((p) => p.id !== id));
  const updatePartition = (id: string, patch: Partial<PartitionDraft>) =>
    setPartitions(partitions.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  const addProperty = () =>
    setProperties([...properties, { id: crypto.randomUUID(), key: '', value: '' }]);
  const removeProperty = (id: string) => setProperties(properties.filter((p) => p.id !== id));
  const updateProperty = (id: string, patch: Partial<PropertyDraft>) =>
    setProperties(properties.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <nav aria-label="Wizard steps" className="flex items-center justify-center gap-2">
        {STEPS.map((s, i) => {
          const done = i < step;
          const active = i === step;
          return (
            <div key={s.id} className="flex items-center gap-2">
              {i > 0 && (
                <div className={cn('h-px w-8 sm:w-12', done || active ? 'bg-indigo-500/50' : 'bg-border')} />
              )}
              <button
                type="button"
                onClick={() => i < step && setStep(i)}
                disabled={i > step}
                className={cn(
                  'flex items-center gap-2 rounded-full px-3 py-1.5 text-sm transition-colors',
                  active && 'bg-indigo-500/15 text-indigo-300 ring-1 ring-indigo-500/30',
                  done && 'text-muted-foreground hover:text-foreground cursor-pointer',
                  !active && !done && 'text-muted-foreground/50 cursor-default',
                )}
              >
                <span
                  className={cn(
                    'flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium',
                    active && 'bg-indigo-500 text-white',
                    done && 'bg-indigo-500/20 text-indigo-400',
                    !active && !done && 'bg-muted text-muted-foreground',
                  )}
                >
                  {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
                </span>
                <span className="hidden sm:inline">{s.label}</span>
              </button>
            </div>
          );
        })}
      </nav>

      {/* Step content */}
      <div className="min-h-[280px]">
        {currentStep.id === 'description' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="table-name">Table Name <span className="text-destructive">*</span></Label>
              <Input
                id="table-name"
                value={tableName}
                onChange={(e) => setTableName(e.target.value)}
                placeholder="my_table"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="table-desc">Description <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Textarea
                id="table-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What this table stores…"
                rows={4}
              />
              <p className="text-xs text-muted-foreground">Saved as the table <code className="text-violet-400">comment</code> property.</p>
            </div>
          </div>
        )}

        {currentStep.id === 'columns' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Schema columns <span className="text-destructive">*</span></Label>
              <Button type="button" variant="outline" size="sm" onClick={addColumn}>
                <Plus className="mr-1 h-3 w-3" /> Add Column
              </Button>
            </div>
            <div className="space-y-2">
              {columns.map((col, idx) => (
                <div key={idx} className="flex items-start gap-2 rounded-md border p-2">
                  <div className="flex-1">
                    <Input
                      placeholder="Column name"
                      value={col.name}
                      onChange={(e) => updateColumn(idx, 'name', e.target.value)}
                    />
                  </div>
                  <div className="w-32">
                    <Select value={col.type} onValueChange={(v) => updateColumn(idx, 'type', v)}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ICEBERG_TYPES.map((t) => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <label className="flex items-center gap-1 text-xs pt-2 whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={col.required}
                      onChange={(e) => updateColumn(idx, 'required', e.target.checked)}
                      className="rounded"
                    />
                    Req
                  </label>
                  <div className="w-28">
                    <Input
                      placeholder="Doc"
                      value={col.doc}
                      onChange={(e) => updateColumn(idx, 'doc', e.target.value)}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeColumn(idx)}
                    disabled={columns.length === 1}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {currentStep.id === 'partitions' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Partition fields</Label>
                <p className="text-xs text-muted-foreground mt-0.5">Optional — leave empty for an unpartitioned table.</p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addPartition}
                disabled={namedColumns.length === 0}
              >
                <Plus className="mr-1 h-3 w-3" /> Add Field
              </Button>
            </div>
            {partitions.length === 0 ? (
              <p className="text-center text-muted-foreground py-8 text-sm border rounded-md border-dashed">
                No partition fields — table will be unpartitioned.
              </p>
            ) : (
              <div className="space-y-3">
                {partitions.map((pf) => (
                  <div key={pf.id} className="rounded-md border p-3 space-y-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Source column</Label>
                        <Select
                          value={pf.sourceColumn}
                          onValueChange={(v) => updatePartition(pf.id, { sourceColumn: v })}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {namedColumns.map((c) => (
                              <SelectItem key={c.name} value={c.name}>
                                {c.name} <span className="text-muted-foreground">({c.type})</span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Transform</Label>
                        <Select
                          value={pf.transform}
                          onValueChange={(v) => updatePartition(pf.id, { transform: v })}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {PARTITION_TRANSFORMS.map((t) => (
                              <SelectItem key={t} value={t}>{t}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    {(pf.transform === 'bucket' || pf.transform === 'truncate') && (
                      <div className="space-y-1">
                        <Label className="text-xs">
                          {pf.transform === 'bucket' ? 'Number of buckets' : 'Truncate width'}
                        </Label>
                        <Input
                          type="number"
                          min={1}
                          value={pf.width}
                          onChange={(e) => updatePartition(pf.id, { width: e.target.value })}
                        />
                      </div>
                    )}
                    <div className="flex justify-end">
                      <Button type="button" variant="ghost" size="sm" onClick={() => removePartition(pf.id)}>
                        <Trash2 className="mr-1 h-3.5 w-3.5 text-destructive" /> Remove
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {currentStep.id === 'properties' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Table properties</Label>
                <p className="text-xs text-muted-foreground mt-0.5">Optional key-value metadata.</p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addProperty}>
                <Plus className="mr-1 h-3 w-3" /> Add
              </Button>
            </div>
            {properties.length === 0 ? (
              <p className="text-center text-muted-foreground py-8 text-sm border rounded-md border-dashed">
                No extra properties.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-2/5">Key</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {properties.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <Input
                          value={row.key}
                          onChange={(e) => updateProperty(row.id, { key: e.target.value })}
                          placeholder="property.key"
                          className="h-8 font-mono text-xs"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={row.value}
                          onChange={(e) => updateProperty(row.id, { value: e.target.value })}
                          className="h-8 font-mono text-xs"
                        />
                      </TableCell>
                      <TableCell>
                        <Button type="button" variant="ghost" size="sm" onClick={() => removeProperty(row.id)}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            {description.trim() && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="outline" className="font-mono">comment</Badge>
                <span className="truncate">{description}</span>
                <span className="text-muted-foreground/60">(from description step)</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between gap-3 pt-2 border-t border-border/60">
        <Button
          type="button"
          variant="ghost"
          onClick={handleSkip}
          disabled={isPending}
        >
          {isLastStep ? 'Skip & Save' : 'Skip'}
        </Button>
        <div className="flex items-center gap-2">
          {!isLastStep && (
            <Button type="button" variant="outline" onClick={goNext} disabled={isPending}>
              Next
            </Button>
          )}
          <Button
            type="button"
            onClick={handleSave}
            disabled={!canSave || isPending}
            className="gradient-primary text-white border-0 hover:opacity-90"
          >
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}

export function toCreateTableRequest(data: TableWizardData): CreateTableRequest {
  return {
    name: data.name,
    columns: data.columns.map((c) => ({
      name: c.name,
      type: c.type,
      required: c.required,
      doc: c.doc || undefined,
    })),
    partitionFields: data.partitionFields.length > 0 ? data.partitionFields : undefined,
    properties: Object.keys(data.properties).length > 0 ? data.properties : undefined,
  };
}

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { alertApi, catalogApi } from '@/api/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Bell, Plus, Loader2, CheckCircle2, AlertTriangle, Clock,
  Mail, X, ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { AlertRuleResponse, CreateAlertRuleRequest, AlertEventResponse } from '@/types';
import { StatusBadge } from '@/components/ui/status-badge';
import { AlertEventsList } from '@/components/alerts/AlertEventsList';

const METRICS: Record<string, { label: string; unit: string }> = {
  SNAPSHOT_COUNT: { label: 'Snapshot Count', unit: '' },
  DATA_FILE_COUNT: { label: 'Data File Count', unit: '' },
  TOTAL_SIZE_BYTES: { label: 'Total Size', unit: 'bytes' },
  DELETE_FILE_COUNT: { label: 'Delete File Count', unit: '' },
  TOTAL_RECORDS: { label: 'Total Records', unit: '' },
};

const OPERATORS: Record<string, string> = {
  GT: '>', LT: '<', GTE: '>=', LTE: '<=', EQ: '=',
};

function getMetricLabel(metric: string): string {
  return METRICS[metric]?.label ?? metric;
}

function getOperatorSymbol(op: string): string {
  return OPERATORS[op] ?? op;
}

export function Alerts() {
  const { data: events, isLoading } = useQuery({
    queryKey: ['alert-events'],
    queryFn: () => alertApi.listEvents(100),
  });
  const { data: rules } = useQuery({
    queryKey: ['alert-rules'],
    queryFn: alertApi.listRules,
  });

  const unacknowledgedCount = events?.filter((e) => e.status === 'TRIGGERED').length ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-red-600 text-white">
          <Bell className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Alerts</h1>
          <p className="text-muted-foreground">
            {unacknowledgedCount > 0
              ? <span className="text-red-500 font-medium">{unacknowledgedCount} unacknowledged alert(s)</span>
              : 'All clear — no active alerts'}
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      ) : (
        <AlertEventsList
          events={events ?? []}
          pageSize={10}
          renderItem={(event) => <AlertEventCard event={event} rules={rules} />}
          emptyState={
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <CheckCircle2 className="h-12 w-12 text-emerald-500 mb-4" />
                <p className="text-muted-foreground text-lg">No alert events</p>
                <p className="text-sm text-muted-foreground">All metrics are within thresholds.</p>
              </CardContent>
            </Card>
          }
        />
      )}
    </div>
  );
}

function AlertEventCard({ event, rules }: { event: AlertEventResponse; rules?: AlertRuleResponse[] }) {
  const queryClient = useQueryClient();

  const acknowledgeMutation = useMutation({
    mutationFn: () => alertApi.acknowledge(event.id),
    onSuccess: () => {
      toast.success('Event acknowledged');
      queryClient.invalidateQueries({ queryKey: ['alert-events'] });
    },
    onError: (err: Error) => toast.error(`Failed: ${err.message}`),
  });

  const rule = rules?.find((r) => r.id === event.ruleId);
  const tableLink = rule
    ? `/catalogs/${rule.catalogId}/namespaces/${rule.namespace}/tables/${rule.tableName}`
    : null;

  return (
    <Card className={`glass shadow-card ${event.status === 'TRIGGERED' ? 'border-l-4 border-l-red-500' : event.status === 'ACKNOWLEDGED' ? 'border-l-4 border-l-blue-500' : ''}`}>
      <CardContent className="flex items-center gap-4 py-3 px-4">
        <div className="shrink-0">
          {event.status === 'TRIGGERED' ? (
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-red-500/10">
              <AlertTriangle className="h-5 w-5 text-red-500" />
            </div>
          ) : event.status === 'RESOLVED' ? (
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/10">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            </div>
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-500/10">
              <Bell className="h-5 w-5 text-blue-500" />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="font-medium text-sm">{event.ruleName}</span>
            <StatusBadge status={event.status} kind="alert" />
            {event.notified && (
              <Badge variant="secondary" className="text-xs"><Mail className="mr-1 h-3 w-3" /> Notified</Badge>
            )}
          </div>
          <p className="text-sm">
            <span className="text-muted-foreground">{getMetricLabel(event.metric)}:</span>{' '}
            <span className="font-semibold text-foreground">{event.currentValue}</span>{' '}
            <span className="text-muted-foreground">{getOperatorSymbol(event.operator)} {event.threshold}</span>
          </p>
          <div className="flex items-center gap-3 mt-1">
            {tableLink ? (
              <Link to={tableLink} className="text-xs text-blue-500 hover:underline flex items-center gap-1">
                <ExternalLink className="h-3 w-3" />
                {event.tableRef}
              </Link>
            ) : (
              <span className="text-xs text-muted-foreground">{event.tableRef}</span>
            )}
            <span className="text-xs text-muted-foreground">
              <Clock className="inline h-3 w-3 mr-0.5" />
              {new Date(event.triggeredAt).toLocaleString()}
            </span>
            {event.resolvedAt && (
              <span className="text-xs text-emerald-400">
                Resolved {new Date(event.resolvedAt).toLocaleString()}
              </span>
            )}
          </div>
        </div>

        {event.status === 'TRIGGERED' && (
          <div className="shrink-0 flex items-center gap-2">
            {tableLink && (
              <Link to={tableLink}>
                <Button variant="outline" size="sm">
                  <ExternalLink className="mr-1 h-3.5 w-3.5" /> View Table
                </Button>
              </Link>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => acknowledgeMutation.mutate()}
              disabled={acknowledgeMutation.isPending}
            >
              {acknowledgeMutation.isPending ? (
                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
              )}
              Ack
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function AlertRuleForm({
  catalogId,
  namespace,
  tableName,
  existingRule,
  onSuccess,
}: {
  catalogId: number;
  namespace: string;
  tableName: string;
  existingRule?: AlertRuleResponse;
  onSuccess: () => void;
}) {
  const queryClient = useQueryClient();
  const { data: catalogs } = useQuery({
    queryKey: ['catalogs'],
    queryFn: catalogApi.list,
  });
  const catalogName = catalogs?.find((c) => c.id === catalogId)?.name ?? '';

  const [name, setName] = useState(existingRule?.name ?? '');
  const [metric, setMetric] = useState(existingRule?.metric ?? 'SNAPSHOT_COUNT');
  const [operator, setOperator] = useState(existingRule?.operator ?? 'GT');
  const [threshold, setThreshold] = useState(existingRule?.threshold ?? 100);
  const [checkInterval, setCheckInterval] = useState(existingRule?.checkIntervalMinutes ?? 60);
  const [emails, setEmails] = useState<string[]>(existingRule?.emails ?? []);
  const [emailInput, setEmailInput] = useState('');
  const [enabled, setEnabled] = useState(existingRule?.enabled ?? true);

  const createMutation = useMutation({
    mutationFn: (data: CreateAlertRuleRequest) =>
      existingRule ? alertApi.updateRule(existingRule.id, data) : alertApi.createRule(data),
    onSuccess: () => {
      toast.success(existingRule ? 'Alert rule updated' : 'Alert rule created');
      queryClient.invalidateQueries({ queryKey: ['alert-rules'] });
      queryClient.invalidateQueries({ queryKey: ['alert-rules-table'] });
      onSuccess();
    },
    onError: (err: Error) => toast.error(`Failed: ${err.message}`),
  });

  const addEmail = () => {
    const trimmed = emailInput.trim();
    if (trimmed && !emails.includes(trimmed)) {
      setEmails([...emails, trimmed]);
      setEmailInput('');
    }
  };

  const handleEmailKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addEmail(); }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({ name, catalogId, namespace, tableName, metric, operator, threshold, checkIntervalMinutes: checkInterval, emails, enabled });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2"><Label>Rule Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. High snapshot count" required /></div>
      <p className="text-xs text-muted-foreground">Target: <span className="font-mono">{catalogName || `catalog #${catalogId}`} / {namespace}.{tableName}</span></p>
      <div className="grid gap-4 grid-cols-2">
        <div className="space-y-2"><Label>Metric</Label><Select value={metric} onValueChange={setMetric}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(METRICS).map(([key, { label }]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-2"><Label>Operator</Label><Select value={operator} onValueChange={setOperator}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(OPERATORS).map(([key, symbol]) => <SelectItem key={key} value={key}>{symbol} ({key})</SelectItem>)}</SelectContent></Select></div>
      </div>
      <div className="grid gap-4 grid-cols-2">
        <div className="space-y-2"><Label>Threshold</Label><Input type="number" value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} required /></div>
        <div className="space-y-2"><Label>Check Interval (minutes)</Label><Input type="number" value={checkInterval} onChange={(e) => setCheckInterval(Number(e.target.value))} min={1} required /></div>
      </div>
      <div className="space-y-2">
        <Label>Email Recipients</Label>
        <div className="flex gap-2"><Input type="email" value={emailInput} onChange={(e) => setEmailInput(e.target.value)} onKeyDown={handleEmailKeyDown} placeholder="user@example.com" /><Button type="button" variant="outline" size="sm" onClick={addEmail}><Plus className="h-4 w-4" /></Button></div>
        {emails.length > 0 && <div className="flex flex-wrap gap-1 mt-2">{emails.map((email) => <Badge key={email} variant="secondary" className="text-xs gap-1">{email}<button type="button" onClick={() => setEmails(emails.filter(e => e !== email))} className="ml-1 hover:text-destructive"><X className="h-3 w-3" /></button></Badge>)}</div>}
      </div>
      <div className="flex items-center gap-2"><Switch id="rule-enabled" checked={enabled} onCheckedChange={(checked) => setEnabled(checked === true)} /><Label htmlFor="rule-enabled">Enabled</Label></div>
      <Button type="submit" disabled={createMutation.isPending}>{createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{existingRule ? 'Update Rule' : 'Create Rule'}</Button>
    </form>
  );
}

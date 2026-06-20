import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Check, Loader2, Database, Server, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { tagColorStyle } from '@/lib/tagColor';
import { CATALOG_ENGINES, engineMeta, type CatalogEngine } from '@/lib/catalogEngines';
import type { CreateCatalogRequest } from '@/types';
import { toCatalogVendor } from '@/types';

const STEPS = [
  { id: 'engine', label: 'Engine' },
  { id: 'connection', label: 'Connection' },
  { id: 'credentials', label: 'Credentials' },
  { id: 'tags', label: 'Tags' },
] as const;

type S3Mode = 'vended' | 'keys' | 'temporary' | 'webidentity';

export function CreateCatalogWizard({ pending, onSubmit }: {
  pending: boolean;
  onSubmit: (req: CreateCatalogRequest) => void;
}) {
  const [step, setStep] = useState(0);

  const [engine, setEngine] = useState<CatalogEngine | null>(null);
  const [name, setName] = useState('');
  const [uri, setUri] = useState('');
  const [warehouse, setWarehouse] = useState('');
  const [authType, setAuthType] = useState<NonNullable<CreateCatalogRequest['authType']>>('NONE');

  const [s3Mode, setS3Mode] = useState<S3Mode>('vended');
  const [s3, setS3] = useState({ endpoint: '', region: '', pathStyle: false, accessKey: '', secretKey: '', sessionToken: '', roleArn: '' });
  const setS3Field = (k: keyof typeof s3, v: string | boolean) => setS3((p) => ({ ...p, [k]: v }));

  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');

  const meta = engine ? engineMeta(engine) : null;
  const isLastStep = step === STEPS.length - 1;

  function pickEngine(id: CatalogEngine) {
    setEngine(id);
    setAuthType(engineMeta(id).defaultAuth);
    if (id === 'polaris') setS3Mode('keys');
    if (id === 'unity') setS3Mode('vended');
  }

  function goNext() {
    if (step === 0 && !engine) { toast.error('Pick a catalog engine'); return; }
    if (step === 1 && !name.trim()) { toast.error('Catalog name is required'); return; }
    if (step === 1 && !uri.trim()) { toast.error('URI is required'); return; }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }
  const goBack = () => setStep((s) => Math.max(s - 1, 0));

  const addTag = (raw: string) => {
    const t = raw.trim();
    if (t && !tags.includes(t)) setTags((d) => [...d, t]);
    setTagInput('');
  };

  function buildRequest(): CreateCatalogRequest | null {
    if (!engine) { toast.error('Pick a catalog engine'); return null; }
    if (!name.trim()) { toast.error('Catalog name is required'); return null; }
    if (!uri.trim()) { toast.error('URI is required'); return null; }

    let credentials: Record<string, string> | undefined;
    if (s3Mode === 'vended') {
      credentials = {};
    } else {
      const c: Record<string, string> = {};
      if (s3.endpoint.trim()) c['s3.endpoint'] = s3.endpoint.trim();
      if (s3.region.trim()) { c['s3.region'] = s3.region.trim(); c['client.region'] = s3.region.trim(); }
      if (s3.pathStyle) c['s3.path-style-access'] = 'true';
      if (s3Mode === 'keys' || s3Mode === 'temporary') {
        if (s3.accessKey.trim()) c['s3.access-key-id'] = s3.accessKey.trim();
        if (s3.secretKey) c['s3.secret-access-key'] = s3.secretKey;
        if (s3Mode === 'temporary' && s3.sessionToken) c['s3.session-token'] = s3.sessionToken;
      }
      if (s3Mode === 'webidentity') {
        c['client.credentials-provider'] = 'software.amazon.awssdk.auth.credentials.WebIdentityTokenFileCredentialsProvider';
        if (s3.roleArn.trim()) c['client.assume-role.arn'] = s3.roleArn.trim();
      }
      credentials = c;
    }

    return {
      name: name.trim(),
      uri: uri.trim(),
      warehouse: warehouse.trim() || undefined,
      authType,
      vendor: toCatalogVendor(engine),
      credentials,
      tags,
    };
  }

  function handleSave() {
    const req = buildRequest();
    if (req) onSubmit(req);
  }

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <nav aria-label="Wizard steps" className="flex items-center justify-center gap-2">
        {STEPS.map((s, i) => {
          const done = i < step;
          const active = i === step;
          return (
            <div key={s.id} className="flex items-center gap-2">
              {i > 0 && <div className={cn('h-px w-8 sm:w-12', done || active ? 'bg-indigo-500/50' : 'bg-border')} />}
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
                <span className={cn(
                  'flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium',
                  active && 'bg-indigo-500 text-white',
                  done && 'bg-indigo-500/20 text-indigo-400',
                  !active && !done && 'bg-muted text-muted-foreground',
                )}>
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
        {/* Step 1 — Engine */}
        {STEPS[step].id === 'engine' && (
          <div className="grid gap-3 sm:grid-cols-2">
            {CATALOG_ENGINES.map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={() => pickEngine(e.id)}
                className={cn(
                  'flex items-start gap-3 rounded-xl border p-4 text-left transition-all',
                  engine === e.id ? 'border-indigo-500/60 bg-indigo-500/[0.06] ring-1 ring-indigo-500/30' : 'border-border/60 hover:border-indigo-500/40 hover:bg-card/60',
                )}
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-background/80 ring-1 ring-border/60">
                  {e.logo
                    ? <img src={e.logo} alt={e.label} className="h-8 w-8 object-contain" />
                    : <Database className="h-6 w-6 text-muted-foreground" />}
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 font-medium">
                    {e.label}
                    {engine === e.id && <Check className="h-4 w-4 text-indigo-400" />}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">{e.description}</span>
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Step 2 — Connection */}
        {STEPS[step].id === 'connection' && meta && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 rounded-md bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
              {meta.logo ? <img src={meta.logo} alt="" className="h-5 w-5 object-contain" /> : <Database className="h-4 w-4" />}
              Configuring a <span className="font-medium text-foreground">{meta.label}</span> catalog
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="my-catalog" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="uri">URI</Label>
              <Input id="uri" value={uri} onChange={(e) => setUri(e.target.value)} placeholder={meta.uriPlaceholder} />
              <p className="text-xs text-muted-foreground">Example: {meta.uriPlaceholder}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="warehouse">Warehouse <span className="text-muted-foreground">(optional)</span></Label>
              <Input id="warehouse" value={warehouse} onChange={(e) => setWarehouse(e.target.value)} placeholder={meta.warehousePlaceholder} />
            </div>
          </div>
        )}

        {/* Step 3 — Credentials */}
        {STEPS[step].id === 'credentials' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="authType">Authentication</Label>
              <Select value={authType} onValueChange={(v) => setAuthType(v as NonNullable<CreateCatalogRequest['authType']>)}>
                <SelectTrigger id="authType"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">None (REST Catalog, Nessie)</SelectItem>
                  <SelectItem value="BEARER">Bearer Token</SelectItem>
                  <SelectItem value="OAUTH2">OAuth2 (Polaris)</SelectItem>
                  <SelectItem value="BASIC">Basic Auth</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3 rounded-lg border border-border/60 p-3">
              <div className="space-y-2">
                <Label htmlFor="s3Mode">S3 / Storage access</Label>
                <Select value={s3Mode} onValueChange={(v) => setS3Mode(v as S3Mode)}>
                  <SelectTrigger id="s3Mode"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="vended">Vended by catalog / default chain</SelectItem>
                    <SelectItem value="keys">Static access keys</SelectItem>
                    <SelectItem value="temporary">Temporary credentials (session token)</SelectItem>
                    <SelectItem value="webidentity">Web identity (IRSA / pod role)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {s3Mode === 'vended' && 'No stored credentials — the catalog vends them, or the backend uses its default AWS chain.'}
                  {s3Mode === 'keys' && 'Static IAM access key + secret (e.g. MinIO minioadmin/minioadmin).'}
                  {s3Mode === 'temporary' && 'Short-lived STS credentials: access key + secret + session token.'}
                  {s3Mode === 'webidentity' && 'Uses the pod service account web identity token.'}
                </p>
              </div>

              {s3Mode !== 'vended' && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label htmlFor="s3Endpoint" className="text-xs">Endpoint <span className="text-muted-foreground">(optional)</span></Label>
                      <Input id="s3Endpoint" value={s3.endpoint} onChange={(e) => setS3Field('endpoint', e.target.value)} placeholder="http://minio:9000" />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="s3Region" className="text-xs">Region</Label>
                      <Input id="s3Region" value={s3.region} onChange={(e) => setS3Field('region', e.target.value)} placeholder="us-east-1" />
                    </div>
                  </div>
                  {(s3Mode === 'keys' || s3Mode === 'temporary') && (
                    <>
                      <div className="space-y-1">
                        <Label htmlFor="s3AccessKey" className="text-xs">Access Key ID</Label>
                        <Input id="s3AccessKey" value={s3.accessKey} onChange={(e) => setS3Field('accessKey', e.target.value)} autoComplete="off" />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="s3SecretKey" className="text-xs">Secret Access Key</Label>
                        <Input id="s3SecretKey" type="password" value={s3.secretKey} onChange={(e) => setS3Field('secretKey', e.target.value)} autoComplete="new-password" />
                      </div>
                    </>
                  )}
                  {s3Mode === 'temporary' && (
                    <div className="space-y-1">
                      <Label htmlFor="s3SessionToken" className="text-xs">Session Token</Label>
                      <Input id="s3SessionToken" type="password" value={s3.sessionToken} onChange={(e) => setS3Field('sessionToken', e.target.value)} autoComplete="off" />
                    </div>
                  )}
                  {s3Mode === 'webidentity' && (
                    <div className="space-y-1">
                      <Label htmlFor="s3RoleArn" className="text-xs">Role ARN <span className="text-muted-foreground">(optional)</span></Label>
                      <Input id="s3RoleArn" value={s3.roleArn} onChange={(e) => setS3Field('roleArn', e.target.value)} placeholder="arn:aws:iam::123456789012:role/my-role" />
                    </div>
                  )}
                  <label className="flex items-center gap-2 text-xs">
                    <input type="checkbox" className="rounded" checked={s3.pathStyle} onChange={(e) => setS3Field('pathStyle', e.target.checked)} />
                    Path-style access (MinIO / non-AWS S3)
                  </label>
                </>
              )}
            </div>
          </div>
        )}

        {/* Step 4 — Tags */}
        {STEPS[step].id === 'tags' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Optional labels to organize and filter catalogs (e.g. <strong>prod</strong>, <strong>draft</strong>).</p>
            <div className="flex flex-wrap gap-1.5 min-h-8">
              {tags.length === 0 && <span className="text-sm text-muted-foreground">No tags yet.</span>}
              {tags.map((tag) => (
                <Badge key={tag} variant="outline" className="gap-1 text-xs font-normal" style={tagColorStyle(tag)}>
                  {tag}
                  <button onClick={() => setTags((d) => d.filter((t) => t !== tag))} title="Remove"><X className="h-3 w-3" /></button>
                </Badge>
              ))}
            </div>
            <Input
              placeholder="Add a tag and press Enter"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(tagInput); } }}
            />

            {/* Summary */}
            <div className="rounded-lg border border-border/60 p-3 text-sm space-y-1">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Server className="h-3.5 w-3.5" /> Summary
              </p>
              <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
                <span className="text-muted-foreground">Engine</span><span>{meta?.label ?? '—'}</span>
                <span className="text-muted-foreground">Name</span><span>{name || '—'}</span>
                <span className="text-muted-foreground">URI</span><span className="font-mono break-all">{uri || '—'}</span>
                <span className="text-muted-foreground">Auth</span><span>{authType}</span>
                <span className="text-muted-foreground">Storage</span><span>{s3Mode}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer nav */}
      <div className="flex items-center justify-between gap-3 pt-2 border-t border-border/60">
        <Button type="button" variant="ghost" onClick={goBack} disabled={step === 0 || pending}>Back</Button>
        <div className="flex items-center gap-2">
          {!isLastStep && (
            <Button type="button" variant="outline" onClick={goNext} disabled={pending}>Next</Button>
          )}
          {isLastStep && (
            <Button type="button" onClick={handleSave} disabled={pending} className="gradient-primary text-white border-0 hover:opacity-90">
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create catalog
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

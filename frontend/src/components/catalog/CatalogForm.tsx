import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Plus, X } from 'lucide-react';
import type { CreateCatalogRequest, CatalogConfig } from '@/types';

type S3Mode = 'keep' | 'vended' | 'keys' | 'temporary' | 'webidentity';
type AuthType = NonNullable<CreateCatalogRequest['authType']>;
type PropRow = { k: string; v: string };

export function CatalogForm({ mode, initial, pending, onSubmit, id, hideSubmit }: {
  mode: 'create' | 'edit';
  initial?: CatalogConfig;
  pending: boolean;
  onSubmit: (req: CreateCatalogRequest) => void;
  id?: string;
  hideSubmit?: boolean;
}) {
  const [s3Mode, setS3Mode] = useState<S3Mode>(mode === 'edit' ? 'keep' : 'vended');
  const [authType, setAuthType] = useState<AuthType>(initial?.authType ?? 'NONE');
  const [bearerToken, setBearerToken] = useState('');
  const [oauthCredential, setOauthCredential] = useState('');
  const [propRows, setPropRows] = useState<PropRow[]>(
    () => Object.entries(initial?.properties ?? {}).map(([k, v]) => ({ k, v })),
  );

  const secretEntered = Boolean(
    (authType === 'BEARER' && bearerToken.trim()) || (authType === 'OAUTH2' && oauthCredential.trim()),
  );

  const addPropRow = () => setPropRows((rows) => [...rows, { k: '', v: '' }]);
  const removePropRow = (i: number) => setPropRows((rows) => rows.filter((_, idx) => idx !== i));
  const setPropRow = (i: number, patch: Partial<PropRow>) =>
    setPropRows((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const get = (k: string) => ((fd.get(k) as string) || '').trim();

    // ── Credentials (secrets). The backend stores credentials all-or-nothing, so a
    // partial update replaces the whole set. We only send `credentials` when the user
    // actually changes something; otherwise it's left undefined and the stored secrets
    // are preserved. ──
    const c: Record<string, string> = {};
    const bearer = bearerToken.trim();
    const oauth = oauthCredential.trim();
    if (authType === 'BEARER' && bearer) c['token'] = bearer;
    if (authType === 'OAUTH2' && oauth) c['credential'] = oauth;

    if (s3Mode !== 'keep' && s3Mode !== 'vended') {
      if (get('s3Endpoint')) c['s3.endpoint'] = get('s3Endpoint');
      if (get('s3Region')) {
        c['s3.region'] = get('s3Region');
        c['client.region'] = get('s3Region');
      }
      if (fd.get('s3PathStyle') === 'on') c['s3.path-style-access'] = 'true';
      if (s3Mode === 'keys' || s3Mode === 'temporary') {
        if (get('s3AccessKey')) c['s3.access-key-id'] = get('s3AccessKey');
        if (get('s3SecretKey')) c['s3.secret-access-key'] = get('s3SecretKey');
        if (s3Mode === 'temporary' && get('s3SessionToken')) c['s3.session-token'] = get('s3SessionToken');
      }
      if (s3Mode === 'webidentity') {
        c['client.credentials-provider'] = 'software.amazon.awssdk.auth.credentials.WebIdentityTokenFileCredentialsProvider';
        if (get('s3RoleArn')) c['client.assume-role.arn'] = get('s3RoleArn');
      }
    }

    // `keep` + no new secret → don't touch stored credentials. Anything else replaces them.
    const credentials = (s3Mode === 'keep' && !secretEntered) ? undefined : c;

    // ── Properties (non-secret, e.g. scope, header.*, io-impl). Always sent so edits persist. ──
    const properties: Record<string, string> = {};
    for (const row of propRows) {
      const key = row.k.trim();
      if (key) properties[key] = row.v.trim();
    }

    onSubmit({
      name: fd.get('name') as string,
      uri: fd.get('uri') as string,
      warehouse: (fd.get('warehouse') as string) || undefined,
      authType,
      vendor: (fd.get('vendor') as CreateCatalogRequest['vendor']) || 'REST',
      credentials,
      properties,
    });
  };

  const replacesSecrets = s3Mode !== 'keep' || secretEntered;

  return (
    <form id={id} onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" placeholder="my-catalog" defaultValue={initial?.name} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="uri">URI</Label>
        <Input id="uri" name="uri" placeholder="http://localhost:8181" defaultValue={initial?.uri} required />
        <p className="text-xs text-muted-foreground">
          REST: http://host:8181 | Nessie: http://host:19120/iceberg |
          Polaris: http://host:8182/api/catalog/v1/warehouse-name |
          Unity: https://&lt;workspace&gt;/api/2.1/unity-catalog/iceberg-rest
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="warehouse">Warehouse</Label>
        <Input id="warehouse" name="warehouse" placeholder="s3://my-bucket/warehouse" defaultValue={initial?.warehouse ?? ''} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="vendor">Catalog type</Label>
        <Select name="vendor" defaultValue={initial?.vendor ?? 'REST'}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="REST">Iceberg REST</SelectItem>
            <SelectItem value="NESSIE">Nessie</SelectItem>
            <SelectItem value="POLARIS">Polaris</SelectItem>
            <SelectItem value="UNITY">Unity Catalog</SelectItem>
            <SelectItem value="OTHER">Other / Custom</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Drives catalog-specific behaviour (e.g. Nessie commit-log history).
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="authType">Authentication</Label>
        <Select value={authType} onValueChange={(v) => setAuthType(v as AuthType)}>
          <SelectTrigger id="authType">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="NONE">None (REST Catalog, Nessie)</SelectItem>
            <SelectItem value="BEARER">Bearer Token (Unity PAT, Snowflake OAT)</SelectItem>
            <SelectItem value="OAUTH2">OAuth2 (Polaris client credentials)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Bearer token / OAuth2 credential (secret) */}
      {authType === 'BEARER' && (
        <div className="space-y-2">
          <Label htmlFor="bearerToken">Bearer token</Label>
          <Input id="bearerToken" name="bearerToken" type="password" autoComplete="new-password"
            value={bearerToken} onChange={(e) => setBearerToken(e.target.value)}
            placeholder={mode === 'edit' ? '•••••• (leave blank to keep current)' : 'eyJ… / dapi…'} />
          <p className="text-xs text-muted-foreground">
            Stored as the REST <code>token</code> property.
            {mode === 'edit' && ' Leave blank to keep the stored token.'}
          </p>
        </div>
      )}
      {authType === 'OAUTH2' && (
        <div className="space-y-2">
          <Label htmlFor="oauthCredential">OAuth2 credential</Label>
          <Input id="oauthCredential" name="oauthCredential" type="password" autoComplete="new-password"
            value={oauthCredential} onChange={(e) => setOauthCredential(e.target.value)}
            placeholder={mode === 'edit' ? '•••••• (leave blank to keep current)' : 'client_id:client_secret'} />
          <p className="text-xs text-muted-foreground">
            <code>client_id:client_secret</code> for the client_credentials flow. Set the OAuth2
            scope (e.g. <code>PRINCIPAL_ROLE:ALL</code>) as a <code>scope</code> property below.
            {mode === 'edit' && ' Leave blank to keep the stored credential.'}
          </p>
        </div>
      )}

      {/* Arbitrary catalog properties: scope, header.*, io-impl, etc. */}
      <div className="space-y-3 rounded-lg border border-border/60 p-3">
        <div className="flex items-center justify-between">
          <Label>Properties</Label>
          <Button type="button" variant="outline" size="sm" onClick={addPropRow}>
            <Plus className="mr-1 h-3.5 w-3.5" /> Add
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Extra RESTCatalog config passed as-is — e.g. <code>scope</code>,
          <code> header.X-Iceberg-Access-Delegation</code>, <code>io-impl</code>.
        </p>
        {propRows.length === 0 && (
          <p className="text-xs text-muted-foreground/70">No properties.</p>
        )}
        {propRows.map((row, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              aria-label="Property key"
              className="flex-1 font-mono text-xs"
              placeholder="key"
              value={row.k}
              onChange={(e) => setPropRow(i, { k: e.target.value })}
            />
            <Input
              aria-label="Property value"
              className="flex-1 font-mono text-xs"
              placeholder="value"
              value={row.v}
              onChange={(e) => setPropRow(i, { v: e.target.value })}
            />
            <button type="button" className="text-muted-foreground hover:text-red-400" onClick={() => removePropRow(i)} title="Remove">
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      <div className="space-y-3 rounded-lg border border-border/60 p-3">
        <div className="space-y-2">
          <Label htmlFor="s3Mode">S3 / Storage access</Label>
          <Select value={s3Mode} onValueChange={(v) => setS3Mode(v as S3Mode)}>
            <SelectTrigger id="s3Mode">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {mode === 'edit' && <SelectItem value="keep">Keep existing</SelectItem>}
              <SelectItem value="vended">Vended by catalog / default chain</SelectItem>
              <SelectItem value="keys">Static access keys</SelectItem>
              <SelectItem value="temporary">Temporary credentials (session token)</SelectItem>
              <SelectItem value="webidentity">Web identity (IRSA / pod role)</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {s3Mode === 'keep' && 'Leave the stored S3 credentials unchanged.'}
            {s3Mode === 'vended' && 'Clear stored S3 credentials — the catalog vends them, or the backend uses its default AWS chain.'}
            {s3Mode === 'keys' && 'Static IAM access key + secret.'}
            {s3Mode === 'temporary' && 'Short-lived STS credentials: access key + secret + session token.'}
            {s3Mode === 'webidentity' && 'Uses the pod service account web identity token (AWS_WEB_IDENTITY_TOKEN_FILE / AWS_ROLE_ARN).'}
          </p>
        </div>

        {(s3Mode === 'keys' || s3Mode === 'temporary' || s3Mode === 'webidentity') && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="s3Endpoint" className="text-xs">Endpoint <span className="text-muted-foreground">(optional)</span></Label>
                <Input id="s3Endpoint" name="s3Endpoint" placeholder="https://s3.amazonaws.com" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="s3Region" className="text-xs">Region</Label>
                <Input id="s3Region" name="s3Region" placeholder="us-east-1" />
              </div>
            </div>

            {(s3Mode === 'keys' || s3Mode === 'temporary') && (
              <>
                <div className="space-y-1">
                  <Label htmlFor="s3AccessKey" className="text-xs">Access Key ID</Label>
                  <Input id="s3AccessKey" name="s3AccessKey" autoComplete="off" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="s3SecretKey" className="text-xs">Secret Access Key</Label>
                  <Input id="s3SecretKey" name="s3SecretKey" type="password" autoComplete="new-password" />
                </div>
              </>
            )}

            {s3Mode === 'temporary' && (
              <div className="space-y-1">
                <Label htmlFor="s3SessionToken" className="text-xs">Session Token</Label>
                <Input id="s3SessionToken" name="s3SessionToken" type="password" autoComplete="off" />
              </div>
            )}

            {s3Mode === 'webidentity' && (
              <div className="space-y-1">
                <Label htmlFor="s3RoleArn" className="text-xs">Role ARN <span className="text-muted-foreground">(optional, else from env)</span></Label>
                <Input id="s3RoleArn" name="s3RoleArn" placeholder="arn:aws:iam::123456789012:role/my-role" />
              </div>
            )}

            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" name="s3PathStyle" className="rounded" />
              Path-style access (MinIO / non-AWS S3)
            </label>
          </>
        )}
        {mode === 'edit' && replacesSecrets && (
          <p className="text-[11px] text-amber-400">
            Saving overwrites the catalog's stored credentials with the token + S3 values above.
          </p>
        )}
      </div>

      {!hideSubmit && (
        <Button type="submit" disabled={pending} className="w-full">
          {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {mode === 'edit' ? 'Save changes' : 'Create'}
        </Button>
      )}
    </form>
  );
}

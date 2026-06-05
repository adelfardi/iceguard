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
import { Loader2 } from 'lucide-react';
import type { CreateCatalogRequest, CatalogConfig } from '@/types';

type S3Mode = 'keep' | 'vended' | 'keys' | 'temporary' | 'webidentity';

export function CatalogForm({ mode, initial, pending, onSubmit, id, hideSubmit }: {
  mode: 'create' | 'edit';
  initial?: CatalogConfig;
  pending: boolean;
  onSubmit: (req: CreateCatalogRequest) => void;
  id?: string;
  hideSubmit?: boolean;
}) {
  const [s3Mode, setS3Mode] = useState<S3Mode>(mode === 'edit' ? 'keep' : 'vended');

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const get = (k: string) => ((fd.get(k) as string) || '').trim();

    let credentials: Record<string, string> | undefined;
    if (s3Mode === 'keep') {
      credentials = undefined;
    } else {
      const c: Record<string, string> = {};
      if (s3Mode !== 'vended') {
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
      credentials = c;
    }

    onSubmit({
      name: fd.get('name') as string,
      uri: fd.get('uri') as string,
      warehouse: (fd.get('warehouse') as string) || undefined,
      authType: (fd.get('authType') as CreateCatalogRequest['authType']) || 'NONE',
      credentials,
    });
  };

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
          Polaris: http://host:8182/api/catalog/v1/warehouse-name
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="warehouse">Warehouse</Label>
        <Input id="warehouse" name="warehouse" placeholder="s3://my-bucket/warehouse" defaultValue={initial?.warehouse ?? ''} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="authType">Authentication</Label>
        <Select name="authType" defaultValue={initial?.authType ?? 'NONE'}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
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
            {s3Mode === 'vended' && 'Clear stored credentials — the catalog vends them, or the backend uses its default AWS chain.'}
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
        {mode === 'edit' && s3Mode !== 'keep' && (
          <p className="text-[11px] text-amber-400">Saving will overwrite the catalog's stored S3 credentials.</p>
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

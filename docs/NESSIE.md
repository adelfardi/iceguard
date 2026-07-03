# Nessie — contournements & particularités

[Project Nessie](https://projectnessie.org/) est un catalog Iceberg « Git-like » : il versionne
les tables via un **commit log** (branches, tags, commits). Son comportement diffère assez d'un
catalog REST/JDBC classique pour qu'IceGuard applique plusieurs contournements spécifiques. Ce
document les recense.

Tout le comportement spécifique Nessie est piloté par le **vendor persité** sur le catalog
(`CatalogConfig.vendor = NESSIE`, Flyway `V8`) — jamais ré-deviné depuis le nom ou l'URI. Le point
d'entrée est `TableService.isNessie(cfg)`.

---

## 1. Reconstruction de l'historique des snapshots depuis le commit log

**Problème.** Via l'API Iceberg standard, une table Nessie n'expose que **le snapshot Iceberg
courant** (`table.snapshots()` → 1 entrée). L'historique réel (appends, overwrites, deletes…) vit
dans le **commit log de Nessie**, pas dans les métadonnées Iceberg.

**Contournement.** Pour les catalogs `NESSIE`, IceGuard reconstruit la liste complète des snapshots
en interrogeant l'API REST Nessie :

```
GET {apiBase}/trees/{ref}/history?fetch=ALL&maxRecords=200
```

- Implémenté dans `NessieHistoryService` (un seul appel HTTP, `connectTimeout` 10 s, `timeout` 30 s).
- Branché dans `TableService.listSnapshots(...)` : si `isNessie(cfg)`, on appelle
  `nessieSnapshots(...)` au lieu de lire `table.snapshots()`.
- Conséquence : le client voit l'historique complet de façon transparente (vue Timeline, graphe
  « Commits », off-peak, etc.).

`TableService.getStatistics(...)` calcule aussi `snapshotCount` via cette reconstruction pour les
tables Nessie.

> Normalisation d'URL : `NessieHistoryService` convertit `http://host/iceberg[/branch]` (ou une base
> `/api/v*`) vers `http://host/api/v2` pour atteindre l'endpoint `history`.

---

## 2. Cache « serve-last-good » de la reconstruction (flakiness réseau)

**Problème.** L'appel au commit log d'un Nessie **distant** (ex. un Nessie de pré-prod) échoue **par
intermittence** (timeout / réseau). Avant le contournement, `listSnapshots` rattrapait l'exception
et **retombait silencieusement** sur le snapshot Iceberg unique → la liste « clignotait » entre
l'historique complet (ex. 53) et **1**. Symptôme côté UI : l'onglet **Overview** affichait par
moments un graphe « Commits » quasi vide et une carte off-peak « limited / no data », alors que la
table a des dizaines de snapshots.

**Contournement.** `TableService.listSnapshots(...)` met en cache la **dernière reconstruction
réussie** par table et la **ressert** en cas d'échec transitoire, au lieu de retomber à 1 :

- Clé : `catalogId + namespace + table`.
- TTL : `NESSIE_SNAPSHOT_TTL_MS = 120_000` (2 min).
- Un appel réussi rafraîchit le cache ; un échec dans la fenêtre TTL renvoie la dernière liste valide.
- On ne tombe sur le snapshot unique **que** si le commit log échoue **et** que le cache est vide
  (typiquement au tout premier chargement) — un refresh suffit alors.

`getCommitActivity` et le graphe « Commits » en bénéficient automatiquement (ils passent tous par
`listSnapshots`).

---

## 3. Stockage S3 réel : région obligatoire

**Problème.** Le listing (métadonnées Nessie) peut fonctionner alors que **Storage** et **Data
sample** échouent : ces deux-là lisent les **manifests + fichiers Parquet sur l'object store**
(S3 réel). Si la région S3 n'est pas configurée, AWS répond **`301 Moved Permanently`** (le client
tape la mauvaise région) → erreur 502 « Could not read storage state » et 500 sur le sample.

**Contournement / config.** Renseigner la région sur les credentials du catalog (la fabrique
`IcebergCatalogClientFactory` propage les clés `s3.*` et `client.*` au `S3FileIO`) :

```
client.region = eu-west-1
s3.region     = eu-west-1
```

Détecter la région d'un bucket : `curl -sI https://<bucket>.s3.amazonaws.com` → en-tête
`x-amz-bucket-region`.

> ⚠️ Une région **tronquée** (ex. `eu-west-` au lieu de `eu-west-1`) produit une URI invalide
> `https://s3.eu-west-.amazonaws.com` et la même erreur — vérifier la valeur exacte au save.

---

## 4. Credentials STS temporaires (expiration ~1 h)

Si les credentials S3 du catalog contiennent un **`s3.session-token`**, ce sont des credentials
**STS temporaires** qui **expirent (~1 h)**. Une fois expirés, les lectures S3 repartent en
**`403 / token expired`**. Il faut **rafraîchir** `s3.access-key-id`, `s3.secret-access-key` et
`s3.session-token` dans le catalog (la région, elle, reste persistée). Pour éviter l'expiration :
utiliser un utilisateur IAM longue durée ou un AssumeRole.

---

## 5. Service Nessie de dev (`docker-compose.dev.yml`)

Pour le sandbox multi-catalog local (`nessie` service, `ghcr.io/projectnessie/nessie`, port
`:19120`, Iceberg REST sur `/iceberg`) :

- **Version store = JDBC** (Postgres, DB `nessie`, schéma auto-créé) → l'historique persiste entre
  redémarrages.
- **MinIO via S3FileIO côté serveur.** Les clés statiques sont une *secret ref* Nessie : les
  **valeurs** des secrets doivent être de la config énumérable, donc passées en **propriétés système
  `-D`** via `JAVA_OPTS_APPEND` (les variables d'env seules ne sont pas énumérables par SmallRye, donc
  le secret provider ne les verrait pas).
- Enregistrer ce catalog dans IceGuard avec **`vendor=NESSIE`**.

---

## Récapitulatif fichiers

| Contournement | Code |
|---|---|
| Détection vendor Nessie | `TableService.isNessie`, `CatalogConfig.vendor` (Flyway `V8`) |
| Reconstruction historique | `NessieHistoryService`, `TableService.nessieSnapshots` / `listSnapshots` |
| Cache serve-last-good | `TableService` (`nessieSnapshotCache`, `NESSIE_SNAPSHOT_TTL_MS`) |
| Propagation creds/région S3 | `catalog/IcebergCatalogClientFactory` (clés `s3.*` / `client.*`) |

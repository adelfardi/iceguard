# Dev notes — Storage/Health & Pipeline work

Attention points, caveats and follow-ups for the Storage & Health / pipeline-run
features added recently. Read before extending or shipping these areas.

## Partition-scoped rewrite (multi-select → Rewrite data files)

- **Only `identity` + temporal transforms are scopable** (`day`/`date`/`month`/`year`/`hour`).
  `bucket`/`truncate`/`void` → the bulk action is disabled (selection is "not scopable").
- The `WHERE` is built on the **source column** (ranges for temporal transforms, equality for
  identity), OR-ed across selected partitions, AND-ed across a partition's fields.
- **Timezone caveat:** temporal range boundaries are computed in **UTC**. For a `timestamptz`
  source column with a non-UTC Spark session tz, the `>= / <` boundaries can be off by the offset.
  Revisit if scoped rewrites ever select the wrong rows on tz-aware columns.
- Rewrite runs **Spark-only** (the `where` named arg is Spark-only). `spark-sql` must be available.
- **String/date literals in the `where` MUST use DOUBLE quotes** (`created_at >= "2026-02-01"`),
  NOT single quotes. Iceberg's `rewrite_data_files` where-parser strips single-quoted literals and
  misparses them (a date `'2026-02-01'` becomes the arithmetic `2026-2-1` → `DATATYPE_MISMATCH`,
  a string `'view'` becomes an unresolved column). The `sqlStr` helper emits `"..."`. Matches the
  Iceberg docs example `where => 'c = "foo"'`. Verified end-to-end on `analytics.events`.
- Partition values come from table metadata (not free user input), so SQL-injection risk is low.
- Large selections produce a large `WHERE` string (OR of N predicates). No cap today.

## Per-partition rewrite execution (bulk dialog)

- The dialog offers two modes: **Whole** (one Spark job, OR-ed WHERE) and **Partition by
  partition** (one job per partition, sequential, with live progress).
- Per-partition mode runs **client-side**: it fires N synchronous HTTP rewrite calls one after
  another from the browser, updating a progress list. **If the tab/dialog is closed mid-run,
  the remaining partitions are not executed** (no server-side job/queue). Consider moving this to
  a backend batch/async job if it needs to survive navigation.
- Each per-partition call re-invalidates the storage queries, so the table stats update live.

## Pipeline task retries + delay

- Per-task reserved params `retries` and `retryDelaySeconds` (stored in `task.parameters`, stripped
  by the backend before building Iceberg options — see `RESERVED_PARAMS`).
- The retry loop lives in `PipelineService.executeTaskRuns` and uses **`Thread.sleep` inside the
  synchronous `@Transactional` run**. The delay therefore **holds the DB transaction open** for
  `retries × delay`. Keep delays modest (seconds), or the transaction can time out. Another reason
  to eventually make pipeline execution async.
- Retry count is "extra attempts" (total attempts = 1 + retries). Failure message gets an
  `(after N retries)` suffix. Verified end-to-end (ROLLBACK-without-snapshotId, retries=2, delay=1s).

## Typed partition filters (Storage → Partitions)

- Backend `search` is now **whitespace AND-tokens**, each matched as a **substring** of the
  partition path. So `region=eu` also matches `region=europe`. Date/number pickers emit exact
  values so this is usually fine; be aware for free-text/text-typed keys.
- Field input type is inferred from the transform, and for `identity` from the **source column
  type** in the schema; unknown/complex types fall back to a text input.

## Per-file data / deletion viewer (Storage → Files → row viewer)

- We intentionally **avoid `parquet-hadoop`** (not on the slim backend classpath). We do **not**
  read the Parquet footer; instead we pick the projection schema from the file's **content type**
  passed by the frontend:
  - `POSITION_DELETES` → fixed `(file_path, pos)` schema.
  - `DATA` / `EQUALITY_DELETES` / unknown → **table schema** (Iceberg maps by field id; columns
    absent from the file — e.g. equality-delete keys — render as `null`).
- **The `content` query param matters:** reading a position-delete file with the table schema
  (wrong/missing `content`) will not map correctly. The frontend always passes `f.content`.
- Values are rendered via `toString`; binary shows as `<binary N bytes>`.
- Reads up to **500 rows** (capped, `hasMore`), client-paginated 25/page.

## Files list "show all" (backend `limit <= 0` = no cap)

- `listPartitionFiles` returns **all files** when `limit <= 0` (the frontend requests this and
  paginates client-side). For a partition/table with a very large file count this can produce a
  **large response** (memory + payload). Consider a safety hard-cap if we ever hit huge tables
  (e.g. an unpartitioned table with 100k+ files). Real example: `distrib/distribmsg` has ~8.5k
  data + ~8.6k delete files table-wide.

## Pipeline runs — Rerun / Retry

- Execution is **synchronous inside a `@Transactional` request** (same as the existing `trigger`).
  A rerun/retry of a long Spark job **blocks the HTTP request** until it finishes — can time out.
  Pre-existing design; amplified by these new entry points. Consider async execution later.
- **Retry** resumes from the failed task: it re-runs the failed task **and every task after it**
  (which were `SKIPPED`), resetting their `startedAt/finishedAt/result/errorMessage`. Upstream
  `SUCCESS` tasks are left untouched. Backend rejects retry on a non-`FAILED` task.
- **No server-side concurrency guard.** The UI disables the buttons while a run is `RUNNING`/
  `PENDING`, but the backend doesn't prevent concurrent rerun/retry calls on the same run.

## Maintenance reliability card (Table → Overview, bottom)

- **"Commits (success)" = successful IceGuard maintenance executions**, NOT table snapshots and
  NOT regular inserts/external writes (IceGuard doesn't record those). The failure rate reflects
  **maintenance reliability only**. Don't read it as overall write-failure rate.
- Computed from two `executions/search` calls (`status=SUCCESS` / `status=FAILED`, reading
  `total`). `PENDING`/`RUNNING`/`CANCELLED` are excluded from the rate.

## Hot / recently-active partitions on Nessie

- `TableStorageService.hotPartitions` iterates `table.snapshots()`, which for **Nessie only holds
  the current snapshot** → it would always report a single partition / single commit. Wrong.
- `TableService.hotPartitions` therefore branches for Nessie: it walks the **commit log**, and for
  each commit inside the window reads that commit's `metadata.json` → snapshot → added/removed data
  files + added delete files → partitions, counting one commit per touched partition.
- **Cost:** one `metadata.json` read (+ manifest reads for added/removed files) **per in-window
  commit**, from (possibly remote) S3 — verified ~15s on the flaky "pre" catalog. If it gets too
  slow on very hot tables, cap the number of commits processed. Falls back to the current-snapshot
  logic if the commit log is empty/unreadable (12s cap, see NessieHistoryService).
- The default UI window is 6h; widen it (the card has an hours input) to see the real activity —
  e.g. a 720h window surfaced 21 commits on one partition where 6h showed 1.

## Updating catalog S3 creds needs a backend restart

- Updating a catalog's `s3.*` credentials via PUT calls `catalogFactory.evict(id)`, but the
  storage scan can still fail with **`Invalid signature`** using the OLD keys — Iceberg's
  `S3FileIO` caches the underlying S3 client (client pool), and evicting the `RESTCatalog` does
  not clear it. **Workaround: restart the backend** after a credential update (verified: 502
  `Invalid signature` before restart → 200 after). A real fix would need to also invalidate
  Iceberg's cached S3 client on update.
- Sanity-check STS creds directly with a SigV4 `GET https://<bucket>.s3.<region>.amazonaws.com/`
  (no query string — signing an empty canonical query while sending `?list-type=2` always yields
  a false `SignatureDoesNotMatch`).

## Catalog 801 "pre" (Snowflake/datacore preprod, real AWS S3)

- Uses **temporary STS credentials** (`ASIA…` + session token), region **eu-west-1**. They
  **expire (~1h)** → the storage endpoint will 403 again; refresh the `s3.*` creds via Edit Catalog.
- URI/warehouse/region are stable; only the access-key/secret/session-token triplet needs refresh.

## Build / workflow gotchas

- **Root `tsc --noEmit` does NOT reliably type-check `TableDetail.tsx`** (missing imports like an
  un-imported icon slipped past it). **Validate with `npm run build` (Vite)** — that's the real check.
- Backend runs as a **packaged jar in Docker** (no live reload). Every backend change needs an
  **image rebuild + `up -d backend`** (slow). Compile locally first (`mvn -q -DskipTests compile`)
  to catch errors before the Docker build.
- `TableStorageService.java` is flagged **binary by git** (`Bin` in diffs) though it's valid UTF-8.
- As of writing, **none of this session's work is committed** — it all lives in the working tree.

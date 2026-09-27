# Storage health: how it works and its limits

The **Storage** tab of a table grades how well its data files are laid out (file sizes, small
files, delete files) for the table as a whole and for every partition. This page explains where
the numbers come from, how the green / amber / red verdict is computed, and what it does not see.

## 1. Where the numbers come from

Everything is computed from **Iceberg metadata only**: no data file is opened.

`TableStorageService.scanStorage` makes **one pass over the manifests of the table's current
snapshot** (`table.currentSnapshot()`, i.e. the head of `main`):

- every **data manifest** entry gives a data file's size, record count and partition;
- every **delete manifest** entry gives a delete file, classified as **position** or **equality**
  delete, and its partition.

From that single pass it builds, in memory:

| Aggregate | Content |
|---|---|
| Table totals | data files, delete files (position / equality), total size, total records, min / max / average data file size, number of small files |
| File-size histogram | data files and bytes per bucket: `< 1 MB`, `1–8 MB`, `8–32 MB`, `32–128 MB`, `128–512 MB`, `> 512 MB` |
| Per partition | the same counters, keyed by the partition path (`spec.partitionToPath(...)`, e.g. `day=2026-09-01/region=eu`) |

The **target file size** is the table property `write.target-file-size-bytes`, or Iceberg's default
**512 MB** when it is not set.

A file is **small** when its size is below the global *small file size* threshold (default
**8 MB**, set in KB).

### Caching

A manifest scan of a remote table can take seconds, so the result is cached **in the backend's
memory for 5 minutes**, keyed by *catalog + table + snapshot id + small-file threshold*. The
overview and every partition page, sort and search reuse the same scan. A new snapshot or a new
small-file threshold gives a new key, so the numbers are never stale with respect to the current
snapshot. The cache holds at most 64 scans and is emptied when full.

### API

| Endpoint | Returns |
|---|---|
| `GET …/tables/{t}/storage` | table totals + histogram (`StorageOverviewResponse`) |
| `GET …/tables/{t}/storage/partitions?offset&limit&sort&dir&search` | paginated, sorted, filtered per-partition aggregates |
| `GET …/tables/{t}/storage/files?partition&limit` | data and delete files of one partition (drill-down) |
| `GET …/tables/{t}/storage/file-data` | rows of one data or delete file (third drill-down level) |
| `GET …/tables/{t}/storage/hot-partitions?windowHours=6` | partitions touched by recent commits |
| `GET / PUT /api/settings/storage-health-thresholds` | the global thresholds |

## 2. Table-level verdict

The backend only returns raw metrics; **the verdict is computed in the frontend**
(`computeStorageHealthStatus`) against the thresholds. Four criteria, each can be turned off:

| Criterion | Formula | Default: amber | Default: red |
|---|---|---|---|
| **Average vs target size** | `avg data file size / target size` (%) | below 90 % | below 50 % |
| **Small files** | `small data files / data files` (%) | above 20 % | above 50 % |
| **Delete file ratio** | `delete files / (data files + delete files)` (%) | above 10 % | above 30 % |
| **Compaction recommended** | more than 1 data file **and** `avg size < target × 50 %` | amber | (never red) |

Percentages are rounded to the nearest integer. The table's verdict is the **worst tone** among
the enabled criteria: any red gives red, otherwise any amber gives amber, otherwise green. An amber
or red verdict adds a warning icon on the Storage tab, and the "compaction recommended" criterion
shows a hint to run **Rewrite Data Files**.

**Example**: 200 data files averaging 6 MB, target 512 MB, 180 of them under 8 MB, 5 position
delete files.

- average vs target: 6 / 512 = 1 %, below 50 % → **red**
- small files: 180 / 200 = 90 %, above 50 % → **red**
- delete ratio: 5 / 205 = 2 % → green
- compaction: 6 MB < 256 MB → **amber**

The verdict is **red**.

### Thresholds

The thresholds are **global** (one set for every table and catalog), stored in the
`storage_health_thresholds` table and edited from the Storage tab (**Health thresholds** button) or
through the API above. Saving checks consistency: warn must be below bad for the "above" criteria,
bad below warn for "average vs target", compaction ratio between 1 and 100, small file size ≥ 1 KB.
Disabled criteria are not validated and do not count in the verdict.

## 3. Partition-level verdict

The partition list shows, for each partition, its data and delete files, size, records, average
file size and small files, plus a health dot.

The dot **reuses exactly the table-level function**, fed with that partition's counters and the
table's target file size. A partition can therefore be red while the table is green, and the other
way round. Partitions can be sorted (size, files, records, name) and filtered with typed per-key
filters (all tokens must match the partition path).

Drill-down: **partition → its files** (data, position and equality deletes; "show all" or 25 per
page) **→ a file's rows**.

**Recently active partitions** (also a dashboard widget) is a separate signal: partitions touched
(files added or removed, delete files added) by any snapshot committed in the last N hours
(default 6), with the number of commits touching each. On Nessie it is rebuilt from the commit log,
since Nessie's live metadata only keeps the current snapshot.

## 4. Limits

### What is measured

- **Only the head of `main`.** Branches and tags are not analysed. Files referenced only by a
  branch, by a tag, or by older snapshots not yet expired are invisible here.
- **Live data only, not the bucket.** "Total size" is the sum of the data files in the current
  snapshot. It excludes delete files' size, metadata (`metadata.json`, manifests, manifest lists,
  statistics), files kept alive by older snapshots, and orphan files. It is not the bill.
- **Records are not net of deletes.** Record counts come from the data files' manifest entries,
  so rows deleted by position or equality delete files are still counted.
- **Delete files are counted, not weighed.** One equality delete file can apply to thousands of
  data files and one position delete file to a single one; both count as 1. The ratio says "there
  are many delete files", not "reads are slowed by X %".
- **The target size is a table property.** If writers override it (e.g. a Spark write option) or
  the table never set it, the comparison uses 512 MB, which may not match the real intent.

### How it is graded

- **Averages hide distributions.** A partition with a few 1 GB files and many 1 KB files can have
  a "good" average. The histogram and the small-file ratio help, but they are table-wide.
- **Small tables are always flagged.** A table (or partition) whose total size is below the target
  can never reach it. A 20 KB table in one file shows "average vs target" at 0 %: red, although one
  file is the best possible layout. Only the "compaction recommended" criterion requires more than
  one file.
- **One global set of thresholds.** A 5 GB table and a 50 TB table, or a streaming table and a
  batch table, are graded with the same numbers. The small-file size is absolute (default 8 MB),
  not relative to each table's target.
- **Partitions have no minimum sample size.** A daily partition with one small file is 100 % small
  files, so red. Tables with many thin partitions (hourly, high-cardinality keys) show a lot of red
  dots that are not worth acting on.

### Partition evolution

- Partitions are keyed by **path per spec**. After a partition spec change, files written with the
  old spec keep their old path and are listed as separate partitions (with their spec id). Files
  written before the table was partitioned appear as **unpartitioned**.
- Delete files are counted in the partition they are written to. Equality deletes written to a
  coarser or unpartitioned spec are not spread over the partitions they affect.

### Operational

- **Nothing alerts on it.** The verdict exists only in the browser when someone opens the Storage
  tab (or a storage widget). It is not stored and does not trigger notifications; use **Alerts**
  rules on table metrics for that.
- **Cost on very large tables.** Each cache miss reads every manifest of the current snapshot and
  keeps every partition's aggregate in memory. Tables with millions of files or partitions make the
  first load slow and memory-hungry for the backend.
- **Per-instance cache.** The 5-minute cache lives in each backend instance's memory. With several
  replicas, each one scans on its own first request.
- **Recently active partitions** only sees snapshots that still exist: expired snapshots are gone,
  and the window is counted from the backend's clock.

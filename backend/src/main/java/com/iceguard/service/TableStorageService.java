package com.iceguard.service;

import com.iceguard.dto.response.PartitionPageResponse;
import com.iceguard.dto.response.StorageFilesResponse;
import com.iceguard.dto.response.StorageOverviewResponse;
import com.iceguard.exception.CatalogOperationException;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.apache.iceberg.DataFile;
import org.apache.iceberg.DeleteFile;
import org.apache.iceberg.FileContent;
import org.apache.iceberg.ManifestFile;
import org.apache.iceberg.ManifestFiles;
import org.apache.iceberg.ManifestReader;
import org.apache.iceberg.PartitionSpec;
import org.apache.iceberg.Snapshot;
import org.apache.iceberg.Table;
import org.apache.iceberg.io.FileIO;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Point-in-time storage state: overview, per-partition aggregates and file listings. */
@ApplicationScoped
public class TableStorageService {

    @Inject
    IcebergTableAccess access;

    @Inject
    StorageHealthThresholdsService storageHealthThresholdsService;

    private static final long[] SIZE_EDGES = {
            1L << 20, 8L << 20, 32L << 20, 128L << 20, 512L << 20
    };
    private static final String[] SIZE_LABELS = {
            "< 1 MB", "1–8 MB", "8–32 MB", "32–128 MB", "128–512 MB", "> 512 MB"
    };

    public StorageOverviewResponse getStorageOverview(Long catalogId, String namespace, String tableName) {
        Table table = access.loadTable(catalogId, namespace, tableName);
        long targetSize = IcebergTableAccess.parseLong(table.properties().getOrDefault(
                "write.target-file-size-bytes", "536870912"));
        List<String> partitionFields = table.spec().fields().stream()
                .map(org.apache.iceberg.PartitionField::name).toList();
        boolean partitioned = !partitionFields.isEmpty();

        Snapshot snapshot = table.currentSnapshot();
        if (snapshot == null) {
            return new StorageOverviewResponse(namespace, tableName, partitioned, partitionFields,
                    -1, 0, 0, 0, 0, 0, 0, 0, 0, 0, targetSize, 0, 0, 0, emptyHistogram());
        }

        StorageHealthThresholdsService.StorageHealthThresholdsConfig thresholds =
                storageHealthThresholdsService.resolve();
        StorageScan scan = scanStorage(table, snapshot, thresholds.smallFileSizeBytes());

        List<StorageOverviewResponse.FileSizeBucket> histogram = new ArrayList<>();
        for (int i = 0; i < SIZE_LABELS.length; i++) {
            histogram.add(new StorageOverviewResponse.FileSizeBucket(
                    SIZE_LABELS[i], scan.bucketCount[i], scan.bucketBytes[i]));
        }

        long maxPartitionSize = scan.byPartition.values().stream()
                .mapToLong(a -> a.totalSize).max().orElse(0);

        return new StorageOverviewResponse(
                namespace, tableName, partitioned, partitionFields,
                snapshot.snapshotId(),
                scan.dataFiles, scan.deleteFiles, scan.posDel, scan.eqDel,
                scan.totalSize, scan.totalRecords,
                scan.dataFiles == 0 ? 0 : scan.minSize, scan.maxSize,
                scan.dataFiles == 0 ? 0 : scan.totalSize / scan.dataFiles,
                targetSize, scan.byPartition.size(), maxPartitionSize, scan.smallFiles, histogram);
    }

    /** Server-side paginated, filtered and sorted partition list. */
    public PartitionPageResponse getStoragePartitions(Long catalogId, String namespace, String tableName,
                                                      int offset, int limit, String sort, String dir, String search) {
        Table table = access.loadTable(catalogId, namespace, tableName);
        Snapshot snapshot = table.currentSnapshot();
        if (snapshot == null) {
            return new PartitionPageResponse(0, offset, limit, List.of());
        }

        StorageScan scan = scanStorage(table, snapshot, storageHealthThresholdsService.resolve().smallFileSizeBytes());

        String q = search == null ? "" : search.trim().toLowerCase();
        Comparator<StorageOverviewResponse.PartitionStorage> cmp = switch (sort == null ? "size" : sort) {
            case "files" -> Comparator.comparingLong(StorageOverviewResponse.PartitionStorage::dataFileCount);
            case "records" -> Comparator.comparingLong(StorageOverviewResponse.PartitionStorage::recordCount);
            case "name" -> Comparator.comparing(StorageOverviewResponse.PartitionStorage::path);
            default -> Comparator.comparingLong(StorageOverviewResponse.PartitionStorage::totalSizeBytes);
        };
        if (!"asc".equalsIgnoreCase(dir)) cmp = cmp.reversed();

        List<StorageOverviewResponse.PartitionStorage> all = scan.byPartition.values().stream()
                .map(Agg::toResponse)
                .filter(p -> q.isEmpty()
                        || (p.path().isEmpty() ? "unpartitioned" : p.path().toLowerCase()).contains(q))
                .sorted(cmp)
                .toList();

        int total = all.size();
        int from = Math.max(0, offset);
        int to = limit <= 0 ? total : Math.min(total, from + limit);
        List<StorageOverviewResponse.PartitionStorage> page = from >= total ? List.of() : all.subList(from, to);

        return new PartitionPageResponse(total, from, limit, page);
    }

    /** Single full pass over the current snapshot's manifests. */
    private StorageScan scanStorage(Table table, Snapshot snapshot, long smallFileSizeBytes) {
        Map<String, Agg> byPartition = new LinkedHashMap<>();
        long[] bucketCount = new long[SIZE_LABELS.length];
        long[] bucketBytes = new long[SIZE_LABELS.length];
        long totalSize = 0, totalRecords = 0, dataFiles = 0;
        long minSize = Long.MAX_VALUE, maxSize = 0;
        long deleteFiles = 0, posDel = 0, eqDel = 0;
        long smallFiles = 0;

        FileIO io = table.io();
        Map<Integer, PartitionSpec> specs = table.specs();

        try {
            for (ManifestFile mf : snapshot.dataManifests(io)) {
                try (ManifestReader<DataFile> reader = ManifestFiles.read(mf, io, specs)) {
                    for (DataFile df : reader) {
                        PartitionSpec spec = specs.get(df.specId());
                        String path = spec.partitionToPath(df.partition());
                        long size = df.fileSizeInBytes();
                        long rec = df.recordCount();
                        byPartition.computeIfAbsent(path, k -> new Agg(k, df.specId()))
                                .addData(size, rec);
                        totalSize += size;
                        totalRecords += rec;
                        dataFiles++;
                        if (size < smallFileSizeBytes) {
                            smallFiles++;
                        }
                        minSize = Math.min(minSize, size);
                        maxSize = Math.max(maxSize, size);
                        int b = bucketIndex(size);
                        bucketCount[b]++;
                        bucketBytes[b] += size;
                    }
                }
            }
            for (ManifestFile mf : snapshot.deleteManifests(io)) {
                try (ManifestReader<DeleteFile> reader = ManifestFiles.readDeleteManifest(mf, io, specs)) {
                    for (DeleteFile df : reader) {
                        PartitionSpec spec = specs.get(df.specId());
                        String path = spec.partitionToPath(df.partition());
                        boolean position = df.content() == FileContent.POSITION_DELETES;
                        byPartition.computeIfAbsent(path, k -> new Agg(k, df.specId()))
                                .addDelete(position);
                        deleteFiles++;
                        if (position) posDel++; else eqDel++;
                    }
                }
            }
        } catch (Exception e) {
            throw new CatalogOperationException("Failed to read storage manifests: " + e.getMessage(), e);
        }

        StorageScan s = new StorageScan();
        s.byPartition = byPartition;
        s.bucketCount = bucketCount;
        s.bucketBytes = bucketBytes;
        s.totalSize = totalSize;
        s.totalRecords = totalRecords;
        s.dataFiles = dataFiles;
        s.minSize = minSize;
        s.maxSize = maxSize;
        s.deleteFiles = deleteFiles;
        s.posDel = posDel;
        s.eqDel = eqDel;
        s.smallFiles = smallFiles;
        return s;
    }

    private static final class StorageScan {
        Map<String, Agg> byPartition;
        long[] bucketCount;
        long[] bucketBytes;
        long totalSize, totalRecords, dataFiles, minSize, maxSize, deleteFiles, posDel, eqDel, smallFiles;
    }

    public StorageFilesResponse listPartitionFiles(Long catalogId, String namespace, String tableName,
                                                    String partition, int limit) {
        Table table = access.loadTable(catalogId, namespace, tableName);
        Snapshot snapshot = table.currentSnapshot();
        List<StorageFilesResponse.FileEntry> files = new ArrayList<>();
        boolean truncated = false;

        if (snapshot != null) {
            FileIO io = table.io();
            Map<Integer, PartitionSpec> specs = table.specs();
            try {
                outer:
                for (ManifestFile mf : snapshot.dataManifests(io)) {
                    try (ManifestReader<DataFile> reader = ManifestFiles.read(mf, io, specs)) {
                        for (DataFile df : reader) {
                            String path = specs.get(df.specId()).partitionToPath(df.partition());
                            if (partition != null && !partition.equals(path)) continue;
                            if (files.size() >= limit) { truncated = true; break outer; }
                            files.add(new StorageFilesResponse.FileEntry(
                                    df.path().toString(), "DATA",
                                    df.fileSizeInBytes(), df.recordCount(), df.specId()));
                        }
                    }
                }
                if (!truncated) {
                    deletes:
                    for (ManifestFile mf : snapshot.deleteManifests(io)) {
                        try (ManifestReader<DeleteFile> reader = ManifestFiles.readDeleteManifest(mf, io, specs)) {
                            for (DeleteFile df : reader) {
                                String path = specs.get(df.specId()).partitionToPath(df.partition());
                                if (partition != null && !partition.equals(path)) continue;
                                if (files.size() >= limit) { truncated = true; break deletes; }
                                files.add(new StorageFilesResponse.FileEntry(
                                        df.path().toString(), df.content().name(),
                                        df.fileSizeInBytes(), df.recordCount(), df.specId()));
                            }
                        }
                    }
                }
            } catch (Exception e) {
                throw new CatalogOperationException("Failed to list partition files: " + e.getMessage(), e);
            }
        }
        return new StorageFilesResponse(partition, files.size(), truncated, files);
    }

    private int bucketIndex(long size) {
        for (int i = 0; i < SIZE_EDGES.length; i++) {
            if (size < SIZE_EDGES[i]) return i;
        }
        return SIZE_LABELS.length - 1;
    }

    private List<StorageOverviewResponse.FileSizeBucket> emptyHistogram() {
        List<StorageOverviewResponse.FileSizeBucket> h = new ArrayList<>();
        for (String label : SIZE_LABELS) {
            h.add(new StorageOverviewResponse.FileSizeBucket(label, 0, 0));
        }
        return h;
    }

    /** Per-partition accumulator. */
    private static final class Agg {
        final String path;
        final int specId;
        long dataFileCount, totalSize, records, deleteFileCount, posDel, eqDel;
        long minSize = Long.MAX_VALUE, maxSize = 0;

        Agg(String path, int specId) {
            this.path = path;
            this.specId = specId;
        }

        void addData(long size, long rec) {
            dataFileCount++;
            totalSize += size;
            records += rec;
            minSize = Math.min(minSize, size);
            maxSize = Math.max(maxSize, size);
        }

        void addDelete(boolean position) {
            deleteFileCount++;
            if (position) posDel++; else eqDel++;
        }

        StorageOverviewResponse.PartitionStorage toResponse() {
            List<StorageOverviewResponse.PartitionValue> values = new ArrayList<>();
            if (path != null && !path.isEmpty()) {
                for (String part : path.split("/")) {
                    int eq = part.indexOf('=');
                    if (eq > 0) {
                        values.add(new StorageOverviewResponse.PartitionValue(
                                part.substring(0, eq), part.substring(eq + 1)));
                    }
                }
            }
            return new StorageOverviewResponse.PartitionStorage(
                    path, values, specId,
                    dataFileCount, deleteFileCount, posDel, eqDel,
                    totalSize,
                    dataFileCount == 0 ? 0 : minSize, maxSize,
                    dataFileCount == 0 ? 0 : totalSize / dataFileCount,
                    records);
        }
    }
}

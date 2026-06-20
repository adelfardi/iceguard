package com.iceguard.service;

import com.iceguard.dto.response.SchemaDiff;
import com.iceguard.dto.response.SchemaHistoryResponse;
import com.iceguard.dto.response.SnapshotDiffResponse;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.apache.iceberg.Schema;
import org.apache.iceberg.Snapshot;
import org.apache.iceberg.Table;
import org.apache.iceberg.types.Types;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.StreamSupport;

/** Schema-version history and snapshot-to-snapshot diffs. */
@ApplicationScoped
public class TableLineageService {

    @Inject
    IcebergTableAccess access;

    private static final List<String[]> DIFF_METRICS = List.of(
            new String[]{"total-records", "Records"},
            new String[]{"total-data-files", "Data files"},
            new String[]{"total-files-size", "Total size (bytes)"},
            new String[]{"total-delete-files", "Delete files"}
    );

    public SchemaHistoryResponse getSchemaHistory(Long catalogId, String namespace, String tableName) {
        Table table = access.loadTable(catalogId, namespace, tableName);

        // Earliest snapshot per schema id (chronological).
        Map<Integer, Snapshot> firstSnapBySchema = new HashMap<>();
        StreamSupport.stream(table.snapshots().spliterator(), false)
                .sorted(Comparator.comparingLong(Snapshot::timestampMillis))
                .forEach(s -> {
                    if (s.schemaId() != null) firstSnapBySchema.putIfAbsent(s.schemaId(), s);
                });

        List<Integer> ids = new ArrayList<>(table.schemas().keySet());
        Collections.sort(ids);

        List<SchemaHistoryResponse.SchemaVersion> versions = new ArrayList<>();
        Schema prev = null;
        for (Integer id : ids) {
            Schema sc = table.schemas().get(id);
            SchemaDiff diff = prev == null ? null : diffSchemas(prev, sc);
            Snapshot snap = firstSnapBySchema.get(id);
            versions.add(new SchemaHistoryResponse.SchemaVersion(
                    id,
                    snap != null ? snap.snapshotId() : null,
                    snap != null ? Instant.ofEpochMilli(snap.timestampMillis()) : null,
                    sc.columns().size(),
                    toColumnRefs(sc),
                    diff,
                    id == table.schema().schemaId()
            ));
            prev = sc;
        }
        return new SchemaHistoryResponse(namespace, tableName, table.schema().schemaId(), versions);
    }

    public SnapshotDiffResponse compareSnapshots(Long catalogId, String namespace, String tableName,
                                                 long fromId, long toId) {
        Table table = access.loadTable(catalogId, namespace, tableName);
        Snapshot from = table.snapshot(fromId);
        Snapshot to = table.snapshot(toId);
        if (from == null) throw new IllegalArgumentException("Snapshot not found: " + fromId);
        if (to == null) throw new IllegalArgumentException("Snapshot not found: " + toId);

        List<SnapshotDiffResponse.MetricDelta> metrics = new ArrayList<>();
        for (String[] m : DIFF_METRICS) {
            long f = IcebergTableAccess.parseLong(from.summary() != null ? from.summary().get(m[0]) : null);
            long t = IcebergTableAccess.parseLong(to.summary() != null ? to.summary().get(m[0]) : null);
            metrics.add(new SnapshotDiffResponse.MetricDelta(m[0], m[1], f, t, t - f));
        }

        SchemaDiff schemaDiff = null;
        if (from.schemaId() != null && to.schemaId() != null
                && !from.schemaId().equals(to.schemaId())) {
            Schema fs = table.schemas().get(from.schemaId());
            Schema ts = table.schemas().get(to.schemaId());
            if (fs != null && ts != null) schemaDiff = diffSchemas(fs, ts);
        }

        return new SnapshotDiffResponse(brief(from), brief(to), metrics, schemaDiff);
    }

    private SnapshotDiffResponse.SnapshotBrief brief(Snapshot s) {
        return new SnapshotDiffResponse.SnapshotBrief(
                s.snapshotId(), Instant.ofEpochMilli(s.timestampMillis()),
                s.operation(), s.schemaId());
    }

    private List<SchemaDiff.ColumnRef> toColumnRefs(Schema schema) {
        return schema.columns().stream()
                .map(f -> new SchemaDiff.ColumnRef(f.fieldId(), f.name(), f.type().toString(), f.isRequired()))
                .toList();
    }

    private SchemaDiff diffSchemas(Schema oldS, Schema newS) {
        Map<Integer, Types.NestedField> oldM = new LinkedHashMap<>();
        for (Types.NestedField f : oldS.columns()) oldM.put(f.fieldId(), f);
        Map<Integer, Types.NestedField> newM = new LinkedHashMap<>();
        for (Types.NestedField f : newS.columns()) newM.put(f.fieldId(), f);

        List<SchemaDiff.ColumnRef> added = new ArrayList<>();
        List<SchemaDiff.ColumnRef> dropped = new ArrayList<>();
        List<SchemaDiff.ColumnChange> modified = new ArrayList<>();
        int unchanged = 0;

        for (var e : newM.entrySet()) {
            if (!oldM.containsKey(e.getKey())) added.add(ref(e.getValue()));
        }
        for (var e : oldM.entrySet()) {
            if (!newM.containsKey(e.getKey())) dropped.add(ref(e.getValue()));
        }
        for (var e : oldM.entrySet()) {
            Types.NestedField nf = newM.get(e.getKey());
            if (nf == null) continue;
            Types.NestedField of = e.getValue();
            List<String> parts = new ArrayList<>();
            String kind = null;
            if (!of.name().equals(nf.name())) {
                parts.add("renamed " + of.name() + " → " + nf.name());
                kind = "RENAMED";
            }
            if (!of.type().toString().equals(nf.type().toString())) {
                parts.add("type " + of.type() + " → " + nf.type());
                kind = "TYPE_CHANGED";
            }
            if (of.isRequired() != nf.isRequired()) {
                parts.add(nf.isRequired() ? "now required" : "now optional");
                if (kind == null) kind = "NULLABILITY";
            }
            if (parts.isEmpty()) {
                unchanged++;
            } else {
                modified.add(new SchemaDiff.ColumnChange(
                        nf.fieldId(), nf.name(), kind, String.join("; ", parts)));
            }
        }

        return new SchemaDiff(oldS.schemaId(), newS.schemaId(), added, dropped, modified, unchanged);
    }

    private SchemaDiff.ColumnRef ref(Types.NestedField f) {
        return new SchemaDiff.ColumnRef(f.fieldId(), f.name(), f.type().toString(), f.isRequired());
    }
}

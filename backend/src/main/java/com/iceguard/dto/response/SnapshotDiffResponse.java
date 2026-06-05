package com.iceguard.dto.response;

import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.databind.ser.std.ToStringSerializer;
import java.time.Instant;
import java.util.List;

/** Comparison between two snapshots: metric deltas and (if changed) the schema diff. */
public record SnapshotDiffResponse(
        SnapshotBrief from,
        SnapshotBrief to,
        List<MetricDelta> metrics,
        SchemaDiff schemaDiff
) {
    public record SnapshotBrief(
            @JsonSerialize(using = ToStringSerializer.class) long snapshotId,
            Instant timestamp,
            String operation,
            Integer schemaId
    ) {}

    public record MetricDelta(String key, String label, long from, long to, long delta) {}
}

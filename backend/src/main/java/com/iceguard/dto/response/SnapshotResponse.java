package com.iceguard.dto.response;

import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.databind.ser.std.ToStringSerializer;
import java.time.Instant;
import java.util.Map;

public record SnapshotResponse(
        // Iceberg snapshot ids are 64-bit; serialize as String so JS clients don't lose precision.
        @JsonSerialize(using = ToStringSerializer.class) long snapshotId,
        @JsonSerialize(using = ToStringSerializer.class) Long parentSnapshotId,
        Instant timestamp,
        String operation,
        Map<String, String> summary,
        String manifestList
) {}

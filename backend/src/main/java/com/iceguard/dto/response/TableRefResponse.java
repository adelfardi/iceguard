package com.iceguard.dto.response;

import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.databind.ser.std.ToStringSerializer;

/** One Iceberg table ref (branch or tag) and its retention policy. */
public record TableRefResponse(
        String name,
        String type,             // BRANCH or TAG
        @JsonSerialize(using = ToStringSerializer.class) long snapshotId,
        Long maxRefAgeMs,        // nullable: table default
        Long maxSnapshotAgeMs,   // branches only, nullable
        Integer minSnapshotsToKeep // branches only, nullable
) {}

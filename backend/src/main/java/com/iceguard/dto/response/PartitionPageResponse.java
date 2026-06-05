package com.iceguard.dto.response;

import java.util.List;

/** A server-side page of partition storage aggregates. */
public record PartitionPageResponse(
        int total,
        int offset,
        int limit,
        List<StorageOverviewResponse.PartitionStorage> partitions
) {}

package com.iceguard.dto.response;

import java.time.Instant;
import java.util.Map;

public record SparkClusterResponse(
        Long id,
        String name,
        String masterUrl,
        String description,
        Map<String, String> properties,
        Instant createdAt,
        Instant updatedAt
) {}

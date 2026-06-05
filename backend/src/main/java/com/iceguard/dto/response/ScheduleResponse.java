package com.iceguard.dto.response;

import java.time.Instant;
import java.util.Map;

public record ScheduleResponse(
        Long id,
        Long catalogId,
        String catalogName,
        String namespace,
        String tableName,
        String actionType,
        String cronExpression,
        Map<String, String> parameters,
        boolean enabled,
        Instant nextRun,
        Instant createdAt,
        Instant updatedAt
) {}

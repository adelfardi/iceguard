package com.iceguard.dto.response;

import com.iceguard.model.ExecutionHistory.ExecutionStatus;
import java.time.Instant;
import java.util.Map;

public record ExecutionResponse(
        Long id,
        Long scheduleId,
        Long catalogId,
        String catalogName,
        String namespace,
        String tableName,
        String actionType,
        ExecutionStatus status,
        Instant startedAt,
        Instant finishedAt,
        Map<String, Object> result,
        String errorMessage
) {}

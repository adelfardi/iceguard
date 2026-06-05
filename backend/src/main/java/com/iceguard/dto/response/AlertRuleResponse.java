package com.iceguard.dto.response;

import java.time.Instant;
import java.util.List;

public record AlertRuleResponse(
        Long id,
        String name,
        Long catalogId,
        String catalogName,
        String namespace,
        String tableName,
        String metric,
        String operator,
        double threshold,
        int checkIntervalMinutes,
        List<String> emails,
        boolean enabled,
        Instant lastCheckedAt,
        Double lastValue,
        String lastStatus,
        Instant createdAt
) {}

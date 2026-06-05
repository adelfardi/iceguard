package com.iceguard.dto.response;

import java.time.Instant;

public record AlertEventResponse(
        Long id,
        Long ruleId,
        String ruleName,
        String metric,
        double currentValue,
        double threshold,
        String operator,
        String tableRef,
        String status,
        boolean notified,
        Instant triggeredAt,
        Instant resolvedAt
) {}

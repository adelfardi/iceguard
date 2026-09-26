package com.iceguard.dto.response;

import java.time.Instant;
import java.util.Map;

public record DashboardWidgetResponse(
        Long id,
        String title,
        String widgetType,
        Long catalogId,
        String namespace,
        String tableName,
        Map<String, String> params,
        int orderIndex,
        Instant createdAt
) {}

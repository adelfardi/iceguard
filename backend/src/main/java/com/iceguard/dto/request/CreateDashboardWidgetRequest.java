package com.iceguard.dto.request;

import jakarta.validation.constraints.NotBlank;
import java.util.Map;

public record CreateDashboardWidgetRequest(
        @NotBlank String title,
        @NotBlank String widgetType,
        Long catalogId,
        String namespace,
        String tableName,
        Map<String, String> params
) {
    public CreateDashboardWidgetRequest {
        if (params == null) params = Map.of();
    }
}

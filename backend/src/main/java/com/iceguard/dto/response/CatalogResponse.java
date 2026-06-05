package com.iceguard.dto.response;

import com.iceguard.model.CatalogConfig.AuthType;
import java.time.Instant;
import java.util.Map;

public record CatalogResponse(
        Long id,
        String name,
        String uri,
        String warehouse,
        Map<String, String> properties,
        AuthType authType,
        Instant createdAt,
        Instant updatedAt
) {}

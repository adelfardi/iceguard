package com.iceguard.dto.response;

import com.iceguard.model.CatalogConfig.AuthType;
import com.iceguard.model.CatalogConfig.Vendor;
import java.time.Instant;
import java.util.List;
import java.util.Map;

public record CatalogResponse(
        Long id,
        String name,
        String uri,
        String warehouse,
        Map<String, String> properties,
        AuthType authType,
        Vendor vendor,
        List<String> tags,
        Instant createdAt,
        Instant updatedAt
) {}

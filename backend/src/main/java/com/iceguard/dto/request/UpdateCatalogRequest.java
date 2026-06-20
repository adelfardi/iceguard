package com.iceguard.dto.request;

import com.iceguard.model.CatalogConfig.AuthType;
import com.iceguard.model.CatalogConfig.Vendor;
import jakarta.validation.constraints.NotBlank;
import java.util.List;
import java.util.Map;

public record UpdateCatalogRequest(
        @NotBlank String name,
        @NotBlank String uri,
        String warehouse,
        Map<String, String> properties,
        AuthType authType,
        Vendor vendor,
        Map<String, String> credentials,
        List<String> tags
) {}

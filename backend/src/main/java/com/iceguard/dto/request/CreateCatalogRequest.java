package com.iceguard.dto.request;

import com.iceguard.model.CatalogConfig.AuthType;
import jakarta.validation.constraints.NotBlank;
import java.util.Map;

public record CreateCatalogRequest(
        @NotBlank String name,
        @NotBlank String uri,
        String warehouse,
        Map<String, String> properties,
        AuthType authType,
        Map<String, String> credentials
) {
    public CreateCatalogRequest {
        if (properties == null) properties = Map.of();
        if (authType == null) authType = AuthType.NONE;
        if (credentials == null) credentials = Map.of();
    }
}

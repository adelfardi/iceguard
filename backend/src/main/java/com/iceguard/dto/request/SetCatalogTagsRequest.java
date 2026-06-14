package com.iceguard.dto.request;

import java.util.List;

public record SetCatalogTagsRequest(List<String> tags) {
    public SetCatalogTagsRequest {
        if (tags == null) tags = List.of();
    }
}

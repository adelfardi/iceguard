package com.iceguard.mapper;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.iceguard.dto.request.CreateCatalogRequest;
import com.iceguard.dto.request.UpdateCatalogRequest;
import com.iceguard.dto.response.CatalogResponse;
import com.iceguard.model.CatalogConfig;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.Map;

@ApplicationScoped
public class CatalogMapper {

    @Inject
    ObjectMapper objectMapper;

    public CatalogConfig toEntity(CreateCatalogRequest request) {
        CatalogConfig entity = new CatalogConfig();
        entity.name = request.name();
        entity.uri = request.uri();
        entity.warehouse = request.warehouse();
        entity.properties = toJson(request.properties());
        entity.authType = request.authType();
        entity.credentials = toJson(request.credentials());
        return entity;
    }

    public void updateEntity(CatalogConfig entity, UpdateCatalogRequest request) {
        entity.name = request.name();
        entity.uri = request.uri();
        entity.warehouse = request.warehouse();
        if (request.properties() != null) entity.properties = toJson(request.properties());
        if (request.authType() != null) entity.authType = request.authType();
        if (request.credentials() != null) entity.credentials = toJson(request.credentials());
    }

    public CatalogResponse toResponse(CatalogConfig entity) {
        return new CatalogResponse(
                entity.id,
                entity.name,
                entity.uri,
                entity.warehouse,
                fromJson(entity.properties),
                entity.authType,
                entity.createdAt,
                entity.updatedAt
        );
    }

    private String toJson(Map<String, String> map) {
        if (map == null || map.isEmpty()) return "{}";
        try {
            return objectMapper.writeValueAsString(map);
        } catch (Exception e) {
            return "{}";
        }
    }

    private Map<String, String> fromJson(String json) {
        if (json == null || json.isBlank() || "{}".equals(json)) return Map.of();
        try {
            return objectMapper.readValue(json, new TypeReference<>() {});
        } catch (Exception e) {
            return Map.of();
        }
    }
}

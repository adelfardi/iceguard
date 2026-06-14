package com.iceguard.mapper;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.iceguard.dto.request.CreateCatalogRequest;
import com.iceguard.dto.request.UpdateCatalogRequest;
import com.iceguard.dto.response.CatalogResponse;
import com.iceguard.model.CatalogConfig;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
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
        entity.tags = tagsToJson(request.tags());
        return entity;
    }

    public void updateEntity(CatalogConfig entity, UpdateCatalogRequest request) {
        entity.name = request.name();
        entity.uri = request.uri();
        entity.warehouse = request.warehouse();
        if (request.properties() != null) entity.properties = toJson(request.properties());
        if (request.authType() != null) entity.authType = request.authType();
        if (request.credentials() != null) entity.credentials = toJson(request.credentials());
        if (request.tags() != null) entity.tags = tagsToJson(request.tags());
    }

    public CatalogResponse toResponse(CatalogConfig entity) {
        return new CatalogResponse(
                entity.id,
                entity.name,
                entity.uri,
                entity.warehouse,
                fromJson(entity.properties),
                entity.authType,
                tagsFromJson(entity.tags),
                entity.createdAt,
                entity.updatedAt
        );
    }

    /** Normalise (trim, drop blanks, de-dup, preserve order) and serialise to a JSON array. */
    public String tagsToJson(List<String> tags) {
        if (tags == null || tags.isEmpty()) return "[]";
        LinkedHashSet<String> clean = new LinkedHashSet<>();
        for (String t : tags) {
            if (t != null && !t.isBlank()) clean.add(t.trim());
        }
        try {
            return objectMapper.writeValueAsString(new ArrayList<>(clean));
        } catch (Exception e) {
            return "[]";
        }
    }

    public List<String> tagsFromJson(String json) {
        if (json == null || json.isBlank() || "[]".equals(json)) return List.of();
        try {
            return objectMapper.readValue(json, new TypeReference<>() {});
        } catch (Exception e) {
            return List.of();
        }
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

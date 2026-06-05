package com.iceguard.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.iceguard.dto.request.SparkClusterRequest;
import com.iceguard.dto.response.SparkClusterResponse;
import com.iceguard.exception.ResourceNotFoundException;
import com.iceguard.model.SparkClusterConfig;
import com.iceguard.repository.SparkClusterConfigRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import java.util.List;
import java.util.Map;

@ApplicationScoped
public class SparkClusterService {

    @Inject
    SparkClusterConfigRepository repository;

    @Inject
    ObjectMapper objectMapper;

    public List<SparkClusterResponse> listAll() {
        return repository.listAll().stream().map(this::toResponse).toList();
    }

    public SparkClusterResponse getById(Long id) {
        return toResponse(findOrThrow(id));
    }

    public SparkClusterConfig findOrThrow(Long id) {
        SparkClusterConfig cluster = repository.findById(id);
        if (cluster == null) {
            throw new ResourceNotFoundException("Spark cluster not found: " + id);
        }
        return cluster;
    }

    @Transactional
    public SparkClusterResponse create(SparkClusterRequest request) {
        SparkClusterConfig cluster = new SparkClusterConfig();
        apply(cluster, request);
        repository.persist(cluster);
        return toResponse(cluster);
    }

    @Transactional
    public SparkClusterResponse update(Long id, SparkClusterRequest request) {
        SparkClusterConfig cluster = findOrThrow(id);
        apply(cluster, request);
        return toResponse(cluster);
    }

    @Transactional
    public void delete(Long id) {
        if (!repository.deleteById(id)) {
            throw new ResourceNotFoundException("Spark cluster not found: " + id);
        }
    }

    private void apply(SparkClusterConfig cluster, SparkClusterRequest request) {
        cluster.name = request.name();
        cluster.masterUrl = request.masterUrl();
        cluster.description = request.description();
        cluster.properties = writeJson(request.properties());
    }

    private String writeJson(Map<String, String> map) {
        if (map == null || map.isEmpty()) return "{}";
        try {
            return objectMapper.writeValueAsString(map);
        } catch (Exception e) {
            return "{}";
        }
    }

    private Map<String, String> parseJson(String json) {
        if (json == null || json.isBlank() || "{}".equals(json)) return Map.of();
        try {
            return objectMapper.readValue(json, new TypeReference<>() {});
        } catch (Exception e) {
            return Map.of();
        }
    }

    private SparkClusterResponse toResponse(SparkClusterConfig c) {
        return new SparkClusterResponse(
                c.id, c.name, c.masterUrl, c.description,
                parseJson(c.properties), c.createdAt, c.updatedAt
        );
    }
}

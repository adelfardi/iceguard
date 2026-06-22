package com.iceguard.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.iceguard.dto.request.SaveSparkSettingsRequest;
import com.iceguard.dto.response.SparkSettingsResponse;
import com.iceguard.model.SparkSettings;
import com.iceguard.repository.SparkSettingsRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

@ApplicationScoped
public class SparkSettingsService {

    @Inject
    SparkSettingsRepository repository;

    @Inject
    ObjectMapper objectMapper;

    public SparkSettingsResponse get() {
        return repository.findFirst()
                .map(this::toResponse)
                .orElseGet(() -> new SparkSettingsResponse(null, null, null, null, Map.of()));
    }

    @Transactional
    public SparkSettingsResponse save(SaveSparkSettingsRequest request) {
        SparkSettings s = repository.findFirst().orElseGet(SparkSettings::new);
        boolean isNew = s.id == null;
        s.driverMemory = blankToNull(request.driverMemory());
        s.executorMemory = blankToNull(request.executorMemory());
        s.executorCores = request.executorCores();
        s.executorInstances = request.executorInstances();
        s.extraConf = toJson(request.extraConf() != null ? request.extraConf() : Map.of());
        s.updatedAt = Instant.now();
        if (isNew) {
            repository.persist(s);
        }
        return toResponse(s);
    }

    /**
     * Resolve the configured tuning into Spark conf key/value pairs
     * ({@code spark.driver.memory}, {@code spark.executor.memory}, …) plus any free-form extras.
     */
    public Map<String, String> resolveConfs() {
        Map<String, String> confs = new LinkedHashMap<>();
        SparkSettings s = repository.findFirst().orElse(null);
        if (s == null) {
            return confs;
        }
        if (notBlank(s.driverMemory)) confs.put("spark.driver.memory", s.driverMemory);
        if (notBlank(s.executorMemory)) confs.put("spark.executor.memory", s.executorMemory);
        if (s.executorCores != null) confs.put("spark.executor.cores", String.valueOf(s.executorCores));
        if (s.executorInstances != null) confs.put("spark.executor.instances", String.valueOf(s.executorInstances));
        confs.putAll(parseJson(s.extraConf));
        return confs;
    }

    private SparkSettingsResponse toResponse(SparkSettings s) {
        return new SparkSettingsResponse(
                s.driverMemory, s.executorMemory, s.executorCores, s.executorInstances,
                parseJson(s.extraConf));
    }

    private String toJson(Map<String, String> map) {
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

    private String blankToNull(String s) {
        return (s == null || s.isBlank()) ? null : s.trim();
    }

    private boolean notBlank(String s) {
        return s != null && !s.isBlank();
    }
}

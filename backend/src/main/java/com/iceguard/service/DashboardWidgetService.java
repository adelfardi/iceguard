package com.iceguard.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.iceguard.dto.request.CreateDashboardWidgetRequest;
import com.iceguard.dto.response.DashboardWidgetResponse;
import com.iceguard.exception.ResourceNotFoundException;
import com.iceguard.model.DashboardWidget;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import java.util.List;
import java.util.Map;

@ApplicationScoped
public class DashboardWidgetService {

    @Inject
    ObjectMapper objectMapper;

    public List<DashboardWidgetResponse> listAll() {
        return DashboardWidget.<DashboardWidget>listAll(
                        io.quarkus.panache.common.Sort.by("orderIndex").and("id"))
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public DashboardWidgetResponse create(CreateDashboardWidgetRequest request) {
        DashboardWidget w = new DashboardWidget();
        w.title = request.title();
        w.widgetType = request.widgetType();
        w.catalogId = request.catalogId();
        w.namespace = request.namespace();
        w.tableName = request.tableName();
        w.params = toJson(request.params());
        w.orderIndex = (int) DashboardWidget.count();
        w.persist();
        return toResponse(w);
    }

    @Transactional
    public void delete(Long id) {
        DashboardWidget w = DashboardWidget.findById(id);
        if (w == null) {
            throw new ResourceNotFoundException("Dashboard widget not found: " + id);
        }
        w.delete();
    }

    @Transactional
    public void reorder(List<Long> orderedIds) {
        for (int i = 0; i < orderedIds.size(); i++) {
            DashboardWidget w = DashboardWidget.findById(orderedIds.get(i));
            if (w != null) w.orderIndex = i;
        }
    }

    private DashboardWidgetResponse toResponse(DashboardWidget w) {
        return new DashboardWidgetResponse(
                w.id, w.title, w.widgetType, w.catalogId, w.namespace, w.tableName,
                fromJson(w.params), w.orderIndex, w.createdAt);
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

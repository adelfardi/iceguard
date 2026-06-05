package com.iceguard.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.iceguard.dto.request.CreateScheduleRequest;
import com.iceguard.dto.response.ScheduleResponse;
import com.iceguard.exception.ResourceNotFoundException;
import com.iceguard.model.CatalogConfig;
import com.iceguard.model.MaintenanceSchedule;
import com.iceguard.repository.MaintenanceScheduleRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import java.util.List;
import java.util.Map;

@ApplicationScoped
public class ScheduleService {

    @Inject
    MaintenanceScheduleRepository repository;

    @Inject
    CatalogService catalogService;

    @Inject
    ObjectMapper objectMapper;

    public List<ScheduleResponse> listAll() {
        return repository.listAll().stream()
                .map(this::toResponse)
                .toList();
    }

    public ScheduleResponse getById(Long id) {
        return toResponse(findOrThrow(id));
    }

    @Transactional
    public ScheduleResponse create(CreateScheduleRequest request) {
        CatalogConfig catalog = catalogService.findOrThrow(request.catalogId());

        MaintenanceSchedule schedule = new MaintenanceSchedule();
        schedule.catalog = catalog;
        schedule.namespace = request.namespace();
        schedule.tableName = request.tableName();
        schedule.actionType = request.actionType();
        schedule.cronExpression = request.cronExpression();
        schedule.enabled = request.enabled();
        try {
            schedule.parameters = objectMapper.writeValueAsString(request.parameters());
        } catch (Exception e) {
            schedule.parameters = "{}";
        }

        repository.persist(schedule);
        return toResponse(schedule);
    }

    @Transactional
    public ScheduleResponse toggleEnabled(Long id, boolean enabled) {
        MaintenanceSchedule schedule = findOrThrow(id);
        schedule.enabled = enabled;
        return toResponse(schedule);
    }

    @Transactional
    public void delete(Long id) {
        MaintenanceSchedule schedule = findOrThrow(id);
        repository.delete(schedule);
    }

    private MaintenanceSchedule findOrThrow(Long id) {
        return repository.findByIdOptional(id)
                .orElseThrow(() -> new ResourceNotFoundException("Schedule not found: " + id));
    }

    private ScheduleResponse toResponse(MaintenanceSchedule s) {
        Map<String, String> params = Map.of();
        try {
            if (s.parameters != null)
                params = objectMapper.readValue(s.parameters, new TypeReference<>() {});
        } catch (Exception ignored) {
        }
        return new ScheduleResponse(
                s.id, s.catalog.id, s.catalog.name,
                s.namespace, s.tableName, s.actionType,
                s.cronExpression, params, s.enabled,
                s.nextRun, s.createdAt, s.updatedAt
        );
    }
}

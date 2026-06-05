package com.iceguard.repository;

import com.iceguard.model.ExecutionHistory;
import com.iceguard.model.ExecutionHistory.ExecutionStatus;
import io.quarkus.hibernate.orm.panache.PanacheQuery;
import io.quarkus.hibernate.orm.panache.PanacheRepository;
import io.quarkus.panache.common.Sort;
import jakarta.enterprise.context.ApplicationScoped;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@ApplicationScoped
public class ExecutionHistoryRepository implements PanacheRepository<ExecutionHistory> {

    public List<ExecutionHistory> findRecent(int limit) {
        return findAll(Sort.by("startedAt").descending()).page(0, limit).list();
    }

    /**
     * Builds a dynamic, ordered query for the execution history. All filters are optional;
     * a {@code null}/blank value means "no constraint on that field". Results are sorted by
     * {@code startedAt} descending. Pagination is applied by the caller on the returned query.
     */
    public PanacheQuery<ExecutionHistory> search(Long catalogId, String namespace, String tableName,
                                                 ExecutionStatus status, Instant from, Instant to) {
        StringBuilder where = new StringBuilder("1 = 1");
        Map<String, Object> params = new HashMap<>();
        if (catalogId != null) {
            where.append(" and catalog.id = :catalogId");
            params.put("catalogId", catalogId);
        }
        if (namespace != null && !namespace.isBlank()) {
            where.append(" and namespace = :namespace");
            params.put("namespace", namespace);
        }
        if (tableName != null && !tableName.isBlank()) {
            where.append(" and tableName = :tableName");
            params.put("tableName", tableName);
        }
        if (status != null) {
            where.append(" and status = :status");
            params.put("status", status);
        }
        if (from != null) {
            where.append(" and startedAt >= :from");
            params.put("from", from);
        }
        if (to != null) {
            where.append(" and startedAt <= :to");
            params.put("to", to);
        }
        return find(where.toString(), Sort.by("startedAt").descending(), params);
    }

    public List<ExecutionHistory> findByCatalogId(Long catalogId) {
        return list("catalog.id", Sort.by("startedAt").descending(), catalogId);
    }

    public List<ExecutionHistory> findByScheduleId(Long scheduleId) {
        return list("schedule.id", Sort.by("startedAt").descending(), scheduleId);
    }
}

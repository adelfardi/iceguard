package com.iceguard.repository;

import com.iceguard.model.AlertEvent;
import io.quarkus.hibernate.orm.panache.PanacheRepository;
import io.quarkus.panache.common.Sort;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.List;

@ApplicationScoped
public class AlertEventRepository implements PanacheRepository<AlertEvent> {

    public List<AlertEvent> findRecent(int limit) {
        return findAll(Sort.by("createdAt").descending()).page(0, limit).list();
    }

    public List<AlertEvent> findByRuleId(Long ruleId) {
        return list("rule.id", Sort.by("createdAt").descending(), ruleId);
    }

    public List<AlertEvent> findByStatus(String status) {
        return list("status", Sort.by("createdAt").descending(), status);
    }
}

package com.iceguard.repository;

import com.iceguard.model.AlertRule;
import io.quarkus.hibernate.orm.panache.PanacheRepository;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.List;

@ApplicationScoped
public class AlertRuleRepository implements PanacheRepository<AlertRule> {

    public List<AlertRule> findByCatalogId(Long catalogId) {
        return list("catalog.id", catalogId);
    }

    public List<AlertRule> findEnabled() {
        return list("enabled", true);
    }
}

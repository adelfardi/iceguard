package com.iceguard.repository;

import com.iceguard.model.TableOverviewThresholds;
import io.quarkus.hibernate.orm.panache.PanacheRepository;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.Optional;

@ApplicationScoped
public class TableOverviewThresholdsRepository implements PanacheRepository<TableOverviewThresholds> {

    public Optional<TableOverviewThresholds> findByTable(Long catalogId, String namespace, String table) {
        return find("catalogId = ?1 and namespace = ?2 and tableName = ?3", catalogId, namespace, table)
                .firstResultOptional();
    }
}

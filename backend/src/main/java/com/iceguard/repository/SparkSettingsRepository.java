package com.iceguard.repository;

import com.iceguard.model.SparkSettings;
import io.quarkus.hibernate.orm.panache.PanacheRepository;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.Optional;

@ApplicationScoped
public class SparkSettingsRepository implements PanacheRepository<SparkSettings> {

    /** Spark settings are a singleton row. */
    public Optional<SparkSettings> findFirst() {
        return findAll().firstResultOptional();
    }
}

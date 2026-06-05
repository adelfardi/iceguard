package com.iceguard.repository;

import com.iceguard.model.SparkClusterConfig;
import io.quarkus.hibernate.orm.panache.PanacheRepository;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.Optional;

@ApplicationScoped
public class SparkClusterConfigRepository implements PanacheRepository<SparkClusterConfig> {

    public Optional<SparkClusterConfig> findByName(String name) {
        return find("name", name).firstResultOptional();
    }
}

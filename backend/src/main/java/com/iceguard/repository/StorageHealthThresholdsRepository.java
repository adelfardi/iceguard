package com.iceguard.repository;

import com.iceguard.model.StorageHealthThresholds;
import io.quarkus.hibernate.orm.panache.PanacheRepository;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.Optional;

@ApplicationScoped
public class StorageHealthThresholdsRepository implements PanacheRepository<StorageHealthThresholds> {

    public Optional<StorageHealthThresholds> findFirst() {
        return findAll().firstResultOptional();
    }
}

package com.iceguard.repository;

import com.iceguard.model.CatalogConfig;
import io.quarkus.hibernate.orm.panache.PanacheRepository;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.Optional;

@ApplicationScoped
public class CatalogConfigRepository implements PanacheRepository<CatalogConfig> {

    public Optional<CatalogConfig> findByName(String name) {
        return find("name", name).firstResultOptional();
    }
}

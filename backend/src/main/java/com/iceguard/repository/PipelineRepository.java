package com.iceguard.repository;

import com.iceguard.model.Pipeline;
import io.quarkus.hibernate.orm.panache.PanacheRepository;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.List;

@ApplicationScoped
public class PipelineRepository implements PanacheRepository<Pipeline> {

    public List<Pipeline> findByCatalogId(Long catalogId) {
        return list("catalog.id", catalogId);
    }
}

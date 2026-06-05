package com.iceguard.service;

import com.iceguard.catalog.IcebergCatalogClientFactory;
import com.iceguard.dto.request.CreateCatalogRequest;
import com.iceguard.dto.request.UpdateCatalogRequest;
import com.iceguard.dto.response.CatalogResponse;
import com.iceguard.dto.response.ConnectionTestResponse;
import com.iceguard.exception.ResourceNotFoundException;
import com.iceguard.mapper.CatalogMapper;
import com.iceguard.model.CatalogConfig;
import com.iceguard.repository.CatalogConfigRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import org.apache.iceberg.rest.RESTCatalog;
import java.util.List;

@ApplicationScoped
public class CatalogService {

    @Inject
    CatalogConfigRepository repository;

    @Inject
    CatalogMapper mapper;

    @Inject
    IcebergCatalogClientFactory catalogFactory;

    public List<CatalogResponse> listAll() {
        return repository.listAll().stream()
                .map(mapper::toResponse)
                .toList();
    }

    public CatalogResponse getById(Long id) {
        return mapper.toResponse(findOrThrow(id));
    }

    @Transactional
    public CatalogResponse create(CreateCatalogRequest request) {
        CatalogConfig entity = mapper.toEntity(request);
        repository.persist(entity);
        return mapper.toResponse(entity);
    }

    @Transactional
    public CatalogResponse update(Long id, UpdateCatalogRequest request) {
        CatalogConfig entity = findOrThrow(id);
        mapper.updateEntity(entity, request);
        catalogFactory.evict(id);
        return mapper.toResponse(entity);
    }

    @Transactional
    public void delete(Long id) {
        CatalogConfig entity = findOrThrow(id);
        catalogFactory.evict(id);
        repository.delete(entity);
    }

    public ConnectionTestResponse testConnection(Long id) {
        CatalogConfig config = findOrThrow(id);
        try {
            RESTCatalog catalog = catalogFactory.createCatalog(config);
            int nsCount = catalog.listNamespaces().size();
            catalog.close();
            return new ConnectionTestResponse(true, "Connection successful", nsCount);
        } catch (Exception e) {
            return new ConnectionTestResponse(false, "Connection failed: " + e.getMessage(), 0);
        }
    }

    public CatalogConfig findOrThrow(Long id) {
        return repository.findByIdOptional(id)
                .orElseThrow(() -> new ResourceNotFoundException("Catalog not found: " + id));
    }
}

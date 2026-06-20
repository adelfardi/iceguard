package com.iceguard.service;

import com.iceguard.dto.request.SaveTableOverviewThresholdsRequest;
import com.iceguard.dto.response.StorageHealthThresholdsResponse;
import com.iceguard.dto.response.TableOverviewThresholdsResponse;
import com.iceguard.exception.CatalogOperationException;
import com.iceguard.model.TableOverviewThresholds;
import com.iceguard.repository.TableOverviewThresholdsRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import java.util.Optional;

@ApplicationScoped
public class TableOverviewThresholdsService {

    @Inject
    TableOverviewThresholdsRepository repository;

    @Inject
    StorageHealthThresholdsService globalService;

    public TableOverviewThresholdsResponse get(Long catalogId, String namespace, String table) {
        StorageHealthThresholdsResponse global = globalService.get();
        Optional<TableOverviewThresholds> override = repository.findByTable(catalogId, namespace, table);
        Integer dfOverride = override.map(o -> o.dataFilesThreshold).orElse(null);
        Integer snapOverride = override.map(o -> o.snapshotCountThreshold).orElse(null);
        return new TableOverviewThresholdsResponse(
                dfOverride != null ? dfOverride : global.dataFilesThreshold(),
                snapOverride != null ? snapOverride : global.snapshotCountThreshold(),
                dfOverride,
                snapOverride,
                global.dataFilesThreshold(),
                global.snapshotCountThreshold());
    }

    @Transactional
    public TableOverviewThresholdsResponse save(Long catalogId, String namespace, String table,
                                                SaveTableOverviewThresholdsRequest request) {
        validate(request);
        Optional<TableOverviewThresholds> existing = repository.findByTable(catalogId, namespace, table);

        // Both overrides cleared → drop the row entirely, reverting to the global defaults.
        if (request.dataFilesThreshold() == null && request.snapshotCountThreshold() == null) {
            existing.ifPresent(repository::delete);
            return get(catalogId, namespace, table);
        }

        TableOverviewThresholds config = existing.orElseGet(() -> {
            TableOverviewThresholds c = new TableOverviewThresholds();
            c.catalogId = catalogId;
            c.namespace = namespace;
            c.tableName = table;
            return c;
        });
        config.dataFilesThreshold = request.dataFilesThreshold();
        config.snapshotCountThreshold = request.snapshotCountThreshold();
        if (existing.isEmpty()) {
            repository.persist(config);
        }
        return get(catalogId, namespace, table);
    }

    private void validate(SaveTableOverviewThresholdsRequest r) {
        if (r.dataFilesThreshold() != null && r.dataFilesThreshold() < 1) {
            throw new CatalogOperationException("Data files threshold must be at least 1");
        }
        if (r.snapshotCountThreshold() != null && r.snapshotCountThreshold() < 1) {
            throw new CatalogOperationException("Snapshot count threshold must be at least 1");
        }
    }
}

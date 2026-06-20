package com.iceguard.service;

import com.iceguard.catalog.IcebergCatalogClientFactory;
import com.iceguard.exception.CatalogOperationException;
import com.iceguard.model.CatalogConfig;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.apache.iceberg.Table;
import org.apache.iceberg.catalog.Namespace;
import org.apache.iceberg.catalog.TableIdentifier;
import org.apache.iceberg.rest.RESTCatalog;

/** Shared catalog/table access used by the per-concern table services. */
@ApplicationScoped
public class IcebergTableAccess {

    @Inject
    IcebergCatalogClientFactory catalogFactory;

    @Inject
    CatalogService catalogService;

    public RESTCatalog getCatalog(Long catalogId) {
        CatalogConfig config = catalogService.findOrThrow(catalogId);
        return catalogFactory.getOrCreate(config);
    }

    public Table loadTable(Long catalogId, String namespace, String tableName) {
        RESTCatalog catalog = getCatalog(catalogId);
        try {
            return catalog.loadTable(TableIdentifier.of(Namespace.of(namespace), tableName));
        } catch (Exception e) {
            throw new CatalogOperationException("Failed to load table " + namespace + "." + tableName, e);
        }
    }

    public static long parseLong(String val) {
        if (val == null) return 0;
        try { return Long.parseLong(val); } catch (NumberFormatException e) { return 0; }
    }
}

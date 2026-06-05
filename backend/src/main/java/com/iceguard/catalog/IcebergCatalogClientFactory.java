package com.iceguard.catalog;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.iceguard.model.CatalogConfig;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.apache.iceberg.CatalogProperties;
import org.apache.iceberg.catalog.Catalog;
import org.apache.iceberg.rest.RESTCatalog;
import java.util.HashMap;
import java.util.Map;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;

@ApplicationScoped
public class IcebergCatalogClientFactory {

    @Inject
    ObjectMapper objectMapper;

    private final ConcurrentHashMap<Long, RESTCatalog> catalogCache = new ConcurrentHashMap<>();

    public RESTCatalog getOrCreate(CatalogConfig config) {
        return catalogCache.computeIfAbsent(config.id, id -> createCatalog(config));
    }

    public void evict(Long catalogId) {
        RESTCatalog catalog = catalogCache.remove(catalogId);
        if (catalog != null) {
            try {
                catalog.close();
            } catch (Exception ignored) {
            }
        }
    }

    public RESTCatalog createCatalog(CatalogConfig config) {
        Map<String, String> props = new HashMap<>();
        props.put(CatalogProperties.URI, config.uri);
        if (config.warehouse != null && !config.warehouse.isBlank()) {
            props.put(CatalogProperties.WAREHOUSE_LOCATION, config.warehouse);
        }

        Map<String, String> extraProps = parseJson(config.properties);
        props.putAll(extraProps);

        Map<String, String> creds = parseJson(config.credentials);
        switch (config.authType) {
            case BEARER -> {
                if (creds.containsKey("token")) {
                    props.put("token", creds.get("token"));
                }
            }
            case OAUTH2 -> {
                props.putAll(creds);
            }
            default -> {}
        }

        // Forward any S3 / AWS client settings stored on the catalog. This covers static keys
        // (s3.access-key-id / s3.secret-access-key), temporary credentials (s3.session-token),
        // and provider-based auth such as web identity / IRSA
        // (client.credentials-provider, client.assume-role.arn, client.assume-role.region, ...).
        Map<String, String> allCreds = parseJson(config.credentials);
        for (var entry : allCreds.entrySet()) {
            String key = entry.getKey();
            if (key.startsWith("s3.") || key.startsWith("client.")) {
                props.put(key, entry.getValue());
            }
        }

        RESTCatalog catalog = new RESTCatalog();
        catalog.initialize(config.name, props);
        return catalog;
    }

    private Map<String, String> parseJson(String json) {
        if (json == null || json.isBlank() || "{}".equals(json)) {
            return Map.of();
        }
        try {
            return objectMapper.readValue(json, new TypeReference<>() {});
        } catch (Exception e) {
            return Map.of();
        }
    }
}

package com.iceguard.mapper;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.iceguard.dto.request.CreateCatalogRequest;
import com.iceguard.dto.request.UpdateCatalogRequest;
import com.iceguard.model.CatalogConfig;
import com.iceguard.model.CatalogConfig.Vendor;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

/** Unit tests for the catalog mapper (vendor inference, credential preservation, tag normalisation). */
class CatalogMapperTest {

    private CatalogMapper mapper;

    @BeforeEach
    void setUp() {
        mapper = new CatalogMapper();
        mapper.objectMapper = new ObjectMapper();
    }

    @Test
    void toEntity_infersVendorFromNameOrUriWhenNotProvided() {
        CreateCatalogRequest req =
                new CreateCatalogRequest("prod-nessie", "http://h/iceberg", null, null, null, null, null, null);
        assertEquals(Vendor.NESSIE, mapper.toEntity(req).vendor);
    }

    @Test
    void toEntity_explicitVendorOverridesTheHeuristic() {
        CreateCatalogRequest req =
                new CreateCatalogRequest("prod-nessie", "http://h/iceberg", null, null, null, Vendor.POLARIS, null, null);
        assertEquals(Vendor.POLARIS, mapper.toEntity(req).vendor);
    }

    @Test
    void updateEntity_nullCredentialsPreservesTheStoredSecret() {
        CatalogConfig existing = new CatalogConfig();
        existing.credentials = "{\"token\":\"secret\"}";
        UpdateCatalogRequest req =
                new UpdateCatalogRequest("n", "http://h", null, null, null, null, null, null); // credentials == null
        mapper.updateEntity(existing, req);
        assertEquals("{\"token\":\"secret\"}", existing.credentials);
    }

    @Test
    void tags_areTrimmedDedupedAndOrderPreservedAcrossJsonRoundTrip() {
        String json = mapper.tagsToJson(List.of(" prod ", "prod", "draft", ""));
        assertEquals(List.of("prod", "draft"), mapper.tagsFromJson(json));
    }
}

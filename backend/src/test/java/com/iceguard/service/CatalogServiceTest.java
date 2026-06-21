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
import org.apache.iceberg.catalog.Namespace;
import org.apache.iceberg.rest.RESTCatalog;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/**
 * Pure unit tests for {@link CatalogService}: every external collaborator — the database
 * repository and the Iceberg catalog client factory — is mocked, so no DB or catalog server
 * is needed.
 */
class CatalogServiceTest {

    private CatalogConfigRepository repository;
    private CatalogMapper mapper;
    private IcebergCatalogClientFactory catalogFactory;
    private CatalogService service;

    @BeforeEach
    void setUp() {
        repository = mock(CatalogConfigRepository.class);
        mapper = mock(CatalogMapper.class);
        catalogFactory = mock(IcebergCatalogClientFactory.class);
        service = new CatalogService();
        service.repository = repository;
        service.mapper = mapper;
        service.catalogFactory = catalogFactory;
    }

    private static CatalogConfig entity(long id) {
        CatalogConfig c = new CatalogConfig();
        c.id = id;
        c.name = "cat-" + id;
        c.uri = "http://host:8181";
        return c;
    }

    private static CatalogResponse anyResponse() {
        return new CatalogResponse(1L, "c", "http://host:8181", null, Map.of(),
                CatalogConfig.AuthType.NONE, CatalogConfig.Vendor.REST, List.of(), null, null);
    }

    @Test
    void getById_missing_throwsNotFound() {
        when(repository.findByIdOptional(99L)).thenReturn(Optional.empty());
        assertThrows(ResourceNotFoundException.class, () -> service.getById(99L));
    }

    @Test
    void create_persistsEntityAndReturnsMappedResponse() {
        CreateCatalogRequest req =
                new CreateCatalogRequest("c", "http://host:8181", null, null, null, null, null, null);
        CatalogConfig built = entity(1);
        CatalogResponse resp = anyResponse();
        when(mapper.toEntity(req)).thenReturn(built);
        when(mapper.toResponse(built)).thenReturn(resp);

        assertSame(resp, service.create(req));
        verify(repository).persist(built);
    }

    @Test
    void update_appliesChangesAndEvictsClientCache() {
        CatalogConfig existing = entity(1);
        UpdateCatalogRequest req =
                new UpdateCatalogRequest("c2", "http://host:8181", null, null, null, null, null, null);
        when(repository.findByIdOptional(1L)).thenReturn(Optional.of(existing));
        when(mapper.toResponse(existing)).thenReturn(anyResponse());

        service.update(1L, req);

        verify(mapper).updateEntity(existing, req);
        verify(catalogFactory).evict(1L);
    }

    @Test
    void delete_evictsCacheAndRemovesEntity() {
        CatalogConfig existing = entity(1);
        when(repository.findByIdOptional(1L)).thenReturn(Optional.of(existing));

        service.delete(1L);

        verify(catalogFactory).evict(1L);
        verify(repository).delete(existing);
    }

    @Test
    void testConnection_success_returnsNamespaceCount() throws Exception {
        CatalogConfig existing = entity(1);
        when(repository.findByIdOptional(1L)).thenReturn(Optional.of(existing));
        RESTCatalog rest = mock(RESTCatalog.class);
        when(catalogFactory.createCatalog(existing)).thenReturn(rest);
        when(rest.listNamespaces()).thenReturn(List.of(Namespace.of("a"), Namespace.of("b")));

        ConnectionTestResponse r = service.testConnection(1L);

        assertTrue(r.success());
        assertEquals(2, r.namespaceCount());
        verify(rest).close();
    }

    @Test
    void testConnection_failure_isReportedNotThrown() {
        CatalogConfig existing = entity(1);
        when(repository.findByIdOptional(1L)).thenReturn(Optional.of(existing));
        when(catalogFactory.createCatalog(existing)).thenThrow(new RuntimeException("unreachable"));

        ConnectionTestResponse r = service.testConnection(1L);

        assertFalse(r.success());
        assertEquals(0, r.namespaceCount());
    }

    @Test
    void setTags_serialisesTagsOntoEntity() {
        CatalogConfig existing = entity(1);
        when(repository.findByIdOptional(1L)).thenReturn(Optional.of(existing));
        when(mapper.tagsToJson(List.of("prod"))).thenReturn("[\"prod\"]");
        when(mapper.toResponse(existing)).thenReturn(anyResponse());

        service.setTags(1L, List.of("prod"));

        assertEquals("[\"prod\"]", existing.tags);
    }
}

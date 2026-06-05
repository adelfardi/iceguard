package com.iceguard.api;

import com.iceguard.dto.request.MaintenanceRequest;
import com.iceguard.dto.response.ExecutionResponse;
import com.iceguard.dto.response.PagedResponse;
import com.iceguard.model.ExecutionHistory.ExecutionStatus;
import com.iceguard.service.MaintenanceService;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import java.time.Instant;
import java.util.List;

@Path("/api/maintenance")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class MaintenanceResource {

    @Inject
    MaintenanceService maintenanceService;

    @POST
    @Path("/catalogs/{catalogId}/namespaces/{namespace}/tables/{table}/expire-snapshots")
    public ExecutionResponse expireSnapshots(@PathParam("catalogId") Long catalogId,
                                             @PathParam("namespace") String namespace,
                                             @PathParam("table") String table,
                                             MaintenanceRequest request) {
        return maintenanceService.expireSnapshots(catalogId, namespace, table, request);
    }

    @POST
    @Path("/catalogs/{catalogId}/namespaces/{namespace}/tables/{table}/rollback")
    public ExecutionResponse rollback(@PathParam("catalogId") Long catalogId,
                                      @PathParam("namespace") String namespace,
                                      @PathParam("table") String table,
                                      MaintenanceRequest request) {
        return maintenanceService.rollback(catalogId, namespace, table, request);
    }

    @POST
    @Path("/catalogs/{catalogId}/namespaces/{namespace}/tables/{table}/rewrite-data-files")
    public ExecutionResponse rewriteDataFiles(@PathParam("catalogId") Long catalogId,
                                               @PathParam("namespace") String namespace,
                                               @PathParam("table") String table,
                                               MaintenanceRequest request) {
        return maintenanceService.rewriteDataFiles(catalogId, namespace, table, request);
    }

    @POST
    @Path("/catalogs/{catalogId}/namespaces/{namespace}/tables/{table}/rewrite-manifests")
    public ExecutionResponse rewriteManifests(@PathParam("catalogId") Long catalogId,
                                               @PathParam("namespace") String namespace,
                                               @PathParam("table") String table,
                                               MaintenanceRequest request) {
        return maintenanceService.rewriteManifests(catalogId, namespace, table, request);
    }

    @POST
    @Path("/catalogs/{catalogId}/namespaces/{namespace}/tables/{table}/remove-orphan-files")
    public ExecutionResponse removeOrphanFiles(@PathParam("catalogId") Long catalogId,
                                                @PathParam("namespace") String namespace,
                                                @PathParam("table") String table,
                                                MaintenanceRequest request) {
        return maintenanceService.removeOrphanFiles(catalogId, namespace, table, request);
    }

    @GET
    @Path("/executions")
    public List<ExecutionResponse> listExecutions(@QueryParam("limit") @DefaultValue("50") int limit) {
        return maintenanceService.listExecutions(limit);
    }

    /**
     * Server-side paginated, filterable execution history. All filter params are optional.
     * {@code status} accepts an {@link ExecutionStatus} name; {@code from}/{@code to} accept
     * ISO-8601 instants (e.g. {@code 2026-06-05T00:00:00Z}). Invalid values are ignored.
     */
    @GET
    @Path("/executions/search")
    public PagedResponse<ExecutionResponse> searchExecutions(
            @QueryParam("catalogId") Long catalogId,
            @QueryParam("namespace") String namespace,
            @QueryParam("table") String table,
            @QueryParam("status") String status,
            @QueryParam("from") String from,
            @QueryParam("to") String to,
            @QueryParam("page") @DefaultValue("0") int page,
            @QueryParam("size") @DefaultValue("20") int size) {
        return maintenanceService.searchExecutions(
                catalogId, namespace, table,
                parseStatus(status), parseInstant(from), parseInstant(to),
                Math.max(0, page), Math.min(Math.max(1, size), 200));
    }

    private static ExecutionStatus parseStatus(String value) {
        if (value == null || value.isBlank()) return null;
        try {
            return ExecutionStatus.valueOf(value.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    private static Instant parseInstant(String value) {
        if (value == null || value.isBlank()) return null;
        try {
            return Instant.parse(value.trim());
        } catch (Exception e) {
            return null;
        }
    }

    @GET
    @Path("/executions/{id}")
    public ExecutionResponse getExecution(@PathParam("id") Long id) {
        return maintenanceService.getExecution(id);
    }
}

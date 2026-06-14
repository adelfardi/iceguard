package com.iceguard.api;

import com.iceguard.dto.request.CreateTableRequest;
import com.iceguard.dto.request.PartitionSpecUpdateRequest;
import com.iceguard.dto.request.SchemaUpdateRequest;
import com.iceguard.dto.response.DataSampleResponse;
import com.iceguard.dto.response.PartitionPageResponse;
import com.iceguard.dto.response.SchemaHistoryResponse;
import com.iceguard.dto.response.SnapshotDiffResponse;
import com.iceguard.dto.response.NessieCommitResponse;
import com.iceguard.dto.response.SnapshotResponse;
import com.iceguard.dto.response.StorageFilesResponse;
import com.iceguard.dto.response.StorageOverviewResponse;
import com.iceguard.dto.response.TableResponse;
import com.iceguard.dto.response.TableStatisticsResponse;
import com.iceguard.service.NessieHistoryService;
import com.iceguard.service.TableService;
import jakarta.inject.Inject;
import jakarta.validation.Valid;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.List;
import java.util.Map;

@Path("/api/catalogs/{catalogId}/namespaces/{namespace}/tables")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class TableResource {

    @Inject
    TableService tableService;

    @Inject
    NessieHistoryService nessieHistoryService;

    /**
     * Real change history for a table on a Nessie catalog, reconstructed from
     * Nessie's commit log (Iceberg only exposes the single current snapshot).
     */
    @GET
    @Path("/{table}/nessie-history")
    public List<NessieCommitResponse> nessieHistory(@PathParam("catalogId") Long catalogId,
                                                    @PathParam("namespace") String namespace,
                                                    @PathParam("table") String table) {
        return nessieHistoryService.tableHistory(catalogId, namespace, table);
    }

    @GET
    public List<String> listTables(@PathParam("catalogId") Long catalogId,
                                   @PathParam("namespace") String namespace) {
        return tableService.listTables(catalogId, namespace);
    }

    @GET
    @Path("/{table}")
    public TableResponse getTable(@PathParam("catalogId") Long catalogId,
                                   @PathParam("namespace") String namespace,
                                   @PathParam("table") String table) {
        return tableService.getTable(catalogId, namespace, table);
    }

    @POST
    public Response createTable(@PathParam("catalogId") Long catalogId,
                                @PathParam("namespace") String namespace,
                                @Valid CreateTableRequest request) {
        tableService.createTable(catalogId, namespace, request);
        return Response.status(Response.Status.CREATED).build();
    }

    @DELETE
    @Path("/{table}")
    public Response dropTable(@PathParam("catalogId") Long catalogId,
                              @PathParam("namespace") String namespace,
                              @PathParam("table") String table,
                              @QueryParam("purge") @DefaultValue("false") boolean purge) {
        tableService.dropTable(catalogId, namespace, table, purge);
        return Response.noContent().build();
    }

    @PUT
    @Path("/{table}/schema")
    public Response updateSchema(@PathParam("catalogId") Long catalogId,
                                 @PathParam("namespace") String namespace,
                                 @PathParam("table") String table,
                                 @Valid SchemaUpdateRequest request) {
        tableService.updateSchema(catalogId, namespace, table, request);
        return Response.ok().build();
    }

    @PUT
    @Path("/{table}/partition-spec")
    public Response updatePartitionSpec(@PathParam("catalogId") Long catalogId,
                                        @PathParam("namespace") String namespace,
                                        @PathParam("table") String table,
                                        @Valid PartitionSpecUpdateRequest request) {
        tableService.updatePartitionSpec(catalogId, namespace, table, request);
        return Response.ok().build();
    }

    @GET
    @Path("/{table}/properties")
    public Map<String, String> getProperties(@PathParam("catalogId") Long catalogId,
                                              @PathParam("namespace") String namespace,
                                              @PathParam("table") String table) {
        return tableService.getProperties(catalogId, namespace, table);
    }

    @PUT
    @Path("/{table}/properties")
    public Response updateProperties(@PathParam("catalogId") Long catalogId,
                                     @PathParam("namespace") String namespace,
                                     @PathParam("table") String table,
                                     Map<String, Object> body) {
        @SuppressWarnings("unchecked")
        Map<String, String> setProps = (Map<String, String>) body.get("set");
        @SuppressWarnings("unchecked")
        List<String> removeProps = (List<String>) body.get("remove");
        tableService.updateProperties(catalogId, namespace, table, setProps, removeProps);
        return Response.ok().build();
    }

    @GET
    @Path("/{table}/snapshots")
    public List<SnapshotResponse> listSnapshots(@PathParam("catalogId") Long catalogId,
                                                 @PathParam("namespace") String namespace,
                                                 @PathParam("table") String table) {
        return tableService.listSnapshots(catalogId, namespace, table);
    }

    @GET
    @Path("/{table}/statistics")
    public TableStatisticsResponse getStatistics(@PathParam("catalogId") Long catalogId,
                                                  @PathParam("namespace") String namespace,
                                                  @PathParam("table") String table) {
        return tableService.getStatistics(catalogId, namespace, table);
    }

    @GET
    @Path("/{table}/schema-history")
    public SchemaHistoryResponse getSchemaHistory(@PathParam("catalogId") Long catalogId,
                                                  @PathParam("namespace") String namespace,
                                                  @PathParam("table") String table) {
        return tableService.getSchemaHistory(catalogId, namespace, table);
    }

    @GET
    @Path("/{table}/snapshot-diff")
    public SnapshotDiffResponse compareSnapshots(@PathParam("catalogId") Long catalogId,
                                                 @PathParam("namespace") String namespace,
                                                 @PathParam("table") String table,
                                                 @QueryParam("from") long from,
                                                 @QueryParam("to") long to) {
        return tableService.compareSnapshots(catalogId, namespace, table, from, to);
    }

    @GET
    @Path("/{table}/storage")
    public StorageOverviewResponse getStorage(@PathParam("catalogId") Long catalogId,
                                              @PathParam("namespace") String namespace,
                                              @PathParam("table") String table) {
        return tableService.getStorageOverview(catalogId, namespace, table);
    }

    @GET
    @Path("/{table}/storage/partitions")
    public PartitionPageResponse getStoragePartitions(@PathParam("catalogId") Long catalogId,
                                                      @PathParam("namespace") String namespace,
                                                      @PathParam("table") String table,
                                                      @QueryParam("offset") @DefaultValue("0") int offset,
                                                      @QueryParam("limit") @DefaultValue("50") int limit,
                                                      @QueryParam("sort") @DefaultValue("size") String sort,
                                                      @QueryParam("dir") @DefaultValue("desc") String dir,
                                                      @QueryParam("search") String search) {
        return tableService.getStoragePartitions(catalogId, namespace, table, offset, limit, sort, dir, search);
    }

    @GET
    @Path("/{table}/storage/files")
    public StorageFilesResponse getStorageFiles(@PathParam("catalogId") Long catalogId,
                                                @PathParam("namespace") String namespace,
                                                @PathParam("table") String table,
                                                @QueryParam("partition") String partition,
                                                @QueryParam("limit") @DefaultValue("500") int limit) {
        return tableService.listPartitionFiles(catalogId, namespace, table, partition, limit);
    }

    @GET
    @Path("/{table}/sample")
    public DataSampleResponse sampleData(@PathParam("catalogId") Long catalogId,
                                          @PathParam("namespace") String namespace,
                                          @PathParam("table") String table,
                                          @QueryParam("limit") @DefaultValue("100") int limit) {
        return tableService.sampleData(catalogId, namespace, table, limit);
    }

    @POST
    @Path("/{table}/data")
    public Response insertData(@PathParam("catalogId") Long catalogId,
                               @PathParam("namespace") String namespace,
                               @PathParam("table") String table,
                               List<Map<String, Object>> rows) {
        int inserted = tableService.insertData(catalogId, namespace, table, rows);
        return Response.ok(Map.of("inserted", inserted)).build();
    }

    @POST
    @Path("/{table}/rename")
    public Response renameTable(@PathParam("catalogId") Long catalogId,
                                @PathParam("namespace") String namespace,
                                @PathParam("table") String table,
                                Map<String, String> body) {
        String newName = body.get("newName");
        if (newName == null || newName.isBlank()) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity(Map.of("error", "newName is required"))
                    .build();
        }
        tableService.renameTable(catalogId, namespace, table, newName);
        return Response.ok().build();
    }
}

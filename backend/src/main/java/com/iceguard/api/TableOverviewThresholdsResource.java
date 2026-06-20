package com.iceguard.api;

import com.iceguard.dto.request.SaveTableOverviewThresholdsRequest;
import com.iceguard.dto.response.TableOverviewThresholdsResponse;
import com.iceguard.service.TableOverviewThresholdsService;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;

@Path("/api/catalogs/{catalogId}/namespaces/{namespace}/tables/{table}/overview-thresholds")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class TableOverviewThresholdsResource {

    @Inject
    TableOverviewThresholdsService service;

    @GET
    public TableOverviewThresholdsResponse get(@PathParam("catalogId") Long catalogId,
                                               @PathParam("namespace") String namespace,
                                               @PathParam("table") String table) {
        return service.get(catalogId, namespace, table);
    }

    @PUT
    public TableOverviewThresholdsResponse save(@PathParam("catalogId") Long catalogId,
                                                @PathParam("namespace") String namespace,
                                                @PathParam("table") String table,
                                                SaveTableOverviewThresholdsRequest request) {
        return service.save(catalogId, namespace, table, request);
    }
}

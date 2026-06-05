package com.iceguard.api;

import com.iceguard.dto.request.CreateNamespaceRequest;
import com.iceguard.dto.response.NamespaceResponse;
import com.iceguard.service.TableService;
import jakarta.inject.Inject;
import jakarta.validation.Valid;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.List;

@Path("/api/catalogs/{catalogId}/namespaces")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class NamespaceResource {

    @Inject
    TableService tableService;

    @GET
    public List<NamespaceResponse> listNamespaces(@PathParam("catalogId") Long catalogId) {
        return tableService.listNamespaces(catalogId);
    }

    @POST
    public Response createNamespace(@PathParam("catalogId") Long catalogId,
                                    @Valid CreateNamespaceRequest request) {
        tableService.createNamespace(catalogId, request.namespace(), request.properties());
        return Response.status(Response.Status.CREATED).build();
    }
}

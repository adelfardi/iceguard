package com.iceguard.api;

import com.iceguard.dto.request.CreateCatalogRequest;
import com.iceguard.dto.request.SetCatalogTagsRequest;
import com.iceguard.dto.request.UpdateCatalogRequest;
import com.iceguard.dto.response.CatalogResponse;
import com.iceguard.dto.response.ConnectionTestResponse;
import com.iceguard.service.CatalogService;
import jakarta.inject.Inject;
import jakarta.validation.Valid;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.List;

@Path("/api/catalogs")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class CatalogResource {

    @Inject
    CatalogService service;

    @GET
    public List<CatalogResponse> listAll() {
        return service.listAll();
    }

    @GET
    @Path("/{id}")
    public CatalogResponse getById(@PathParam("id") Long id) {
        return service.getById(id);
    }

    @POST
    public Response create(@Valid CreateCatalogRequest request) {
        CatalogResponse response = service.create(request);
        return Response.status(Response.Status.CREATED).entity(response).build();
    }

    @PUT
    @Path("/{id}")
    public CatalogResponse update(@PathParam("id") Long id, @Valid UpdateCatalogRequest request) {
        return service.update(id, request);
    }

    @PUT
    @Path("/{id}/tags")
    public CatalogResponse setTags(@PathParam("id") Long id, SetCatalogTagsRequest request) {
        return service.setTags(id, request.tags());
    }

    @DELETE
    @Path("/{id}")
    public Response delete(@PathParam("id") Long id) {
        service.delete(id);
        return Response.noContent().build();
    }

    @POST
    @Path("/{id}/test-connection")
    public ConnectionTestResponse testConnection(@PathParam("id") Long id) {
        return service.testConnection(id);
    }
}

package com.iceguard.api;

import com.iceguard.dto.request.SparkClusterRequest;
import com.iceguard.dto.response.SparkClusterResponse;
import com.iceguard.service.SparkClusterService;
import jakarta.inject.Inject;
import jakarta.validation.Valid;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.List;

@Path("/api/spark-clusters")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class SparkClusterResource {

    @Inject
    SparkClusterService service;

    @GET
    public List<SparkClusterResponse> listAll() {
        return service.listAll();
    }

    @GET
    @Path("/{id}")
    public SparkClusterResponse getById(@PathParam("id") Long id) {
        return service.getById(id);
    }

    @POST
    public Response create(@Valid SparkClusterRequest request) {
        SparkClusterResponse response = service.create(request);
        return Response.status(Response.Status.CREATED).entity(response).build();
    }

    @PUT
    @Path("/{id}")
    public SparkClusterResponse update(@PathParam("id") Long id, @Valid SparkClusterRequest request) {
        return service.update(id, request);
    }

    @DELETE
    @Path("/{id}")
    public Response delete(@PathParam("id") Long id) {
        service.delete(id);
        return Response.noContent().build();
    }
}

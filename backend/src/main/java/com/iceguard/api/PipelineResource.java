package com.iceguard.api;

import com.iceguard.dto.request.CreatePipelineRequest;
import com.iceguard.dto.request.UpdatePipelineRequest;
import com.iceguard.dto.response.PipelineResponse;
import com.iceguard.dto.response.PipelineRunResponse;
import com.iceguard.service.PipelineService;
import jakarta.inject.Inject;
import jakarta.validation.Valid;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.List;

@Path("/api/pipelines")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class PipelineResource {

    @Inject
    PipelineService service;

    @GET
    public List<PipelineResponse> listAll() {
        return service.listAll();
    }

    @POST
    public Response create(@Valid CreatePipelineRequest request) {
        PipelineResponse response = service.create(request);
        return Response.status(Response.Status.CREATED).entity(response).build();
    }

    @GET
    @Path("/{id}")
    public PipelineResponse getById(@PathParam("id") Long id) {
        return service.getById(id);
    }

    @PUT
    @Path("/{id}")
    public PipelineResponse update(@PathParam("id") Long id, @Valid UpdatePipelineRequest request) {
        return service.update(id, request);
    }

    @PUT
    @Path("/{id}/toggle")
    public PipelineResponse toggleEnabled(@PathParam("id") Long id,
                                           @QueryParam("enabled") boolean enabled) {
        return service.toggleEnabled(id, enabled);
    }

    @DELETE
    @Path("/{id}")
    public Response delete(@PathParam("id") Long id) {
        service.delete(id);
        return Response.noContent().build();
    }

    @POST
    @Path("/{id}/trigger")
    public PipelineRunResponse trigger(@PathParam("id") Long id) {
        return service.trigger(id);
    }

    @GET
    @Path("/{id}/runs")
    public List<PipelineRunResponse> listRuns(@PathParam("id") Long id) {
        return service.listRuns(id);
    }

    @GET
    @Path("/runs/recent")
    public List<PipelineRunResponse> listRecentRuns(@QueryParam("limit") @DefaultValue("20") int limit) {
        return service.listRecentRuns(limit);
    }

    @GET
    @Path("/runs/{runId}")
    public PipelineRunResponse getRun(@PathParam("runId") Long runId) {
        return service.getRun(runId);
    }
}

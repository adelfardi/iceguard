package com.iceguard.api;

import com.iceguard.dto.request.CreateScheduleRequest;
import com.iceguard.dto.response.ScheduleResponse;
import com.iceguard.service.ScheduleService;
import jakarta.inject.Inject;
import jakarta.validation.Valid;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.List;

@Path("/api/schedules")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class ScheduleResource {

    @Inject
    ScheduleService service;

    @GET
    public List<ScheduleResponse> listAll() {
        return service.listAll();
    }

    @GET
    @Path("/{id}")
    public ScheduleResponse getById(@PathParam("id") Long id) {
        return service.getById(id);
    }

    @POST
    public Response create(@Valid CreateScheduleRequest request) {
        ScheduleResponse response = service.create(request);
        return Response.status(Response.Status.CREATED).entity(response).build();
    }

    @PUT
    @Path("/{id}/toggle")
    public ScheduleResponse toggle(@PathParam("id") Long id,
                                    @QueryParam("enabled") boolean enabled) {
        return service.toggleEnabled(id, enabled);
    }

    @DELETE
    @Path("/{id}")
    public Response delete(@PathParam("id") Long id) {
        service.delete(id);
        return Response.noContent().build();
    }
}

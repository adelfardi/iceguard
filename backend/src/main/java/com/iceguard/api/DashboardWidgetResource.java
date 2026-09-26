package com.iceguard.api;

import com.iceguard.dto.request.CreateDashboardWidgetRequest;
import com.iceguard.dto.response.DashboardWidgetResponse;
import com.iceguard.service.DashboardWidgetService;
import jakarta.inject.Inject;
import jakarta.validation.Valid;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.List;

@Path("/api/dashboard-widgets")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class DashboardWidgetResource {

    @Inject
    DashboardWidgetService service;

    @GET
    public List<DashboardWidgetResponse> list() {
        return service.listAll();
    }

    @POST
    public DashboardWidgetResponse create(@Valid CreateDashboardWidgetRequest request) {
        return service.create(request);
    }

    @DELETE
    @Path("/{id}")
    public Response delete(@PathParam("id") Long id) {
        service.delete(id);
        return Response.noContent().build();
    }

    @PUT
    @Path("/reorder")
    public Response reorder(List<Long> orderedIds) {
        service.reorder(orderedIds);
        return Response.noContent().build();
    }
}

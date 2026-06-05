package com.iceguard.api;

import com.iceguard.dto.request.CreateAlertRuleRequest;
import com.iceguard.dto.request.UpdateAlertRuleRequest;
import com.iceguard.dto.response.AlertEventResponse;
import com.iceguard.dto.response.AlertRuleResponse;
import com.iceguard.service.AlertService;
import jakarta.inject.Inject;
import jakarta.validation.Valid;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.List;

@Path("/api/alerts")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class AlertResource {

    @Inject
    AlertService service;

    @GET
    @Path("/rules")
    public List<AlertRuleResponse> listRules() {
        return service.listRules();
    }

    @POST
    @Path("/rules")
    public Response createRule(@Valid CreateAlertRuleRequest request) {
        AlertRuleResponse response = service.createRule(request);
        return Response.status(Response.Status.CREATED).entity(response).build();
    }

    @GET
    @Path("/rules/{id}")
    public AlertRuleResponse getRule(@PathParam("id") Long id) {
        return service.getRule(id);
    }

    @PUT
    @Path("/rules/{id}")
    public AlertRuleResponse updateRule(@PathParam("id") Long id, @Valid UpdateAlertRuleRequest request) {
        return service.updateRule(id, request);
    }

    @DELETE
    @Path("/rules/{id}")
    public Response deleteRule(@PathParam("id") Long id) {
        service.deleteRule(id);
        return Response.noContent().build();
    }

    @PUT
    @Path("/rules/{id}/toggle")
    public AlertRuleResponse toggleRule(@PathParam("id") Long id,
                                         @QueryParam("enabled") boolean enabled) {
        return service.toggleRule(id, enabled);
    }

    @GET
    @Path("/events")
    public List<AlertEventResponse> listEvents(@QueryParam("limit") @DefaultValue("50") int limit) {
        return service.listEvents(limit);
    }

    @GET
    @Path("/events/rule/{ruleId}")
    public List<AlertEventResponse> listEventsByRule(@PathParam("ruleId") Long ruleId) {
        return service.listEventsByRule(ruleId);
    }

    @PUT
    @Path("/events/{id}/acknowledge")
    public AlertEventResponse acknowledgeEvent(@PathParam("id") Long id) {
        return service.acknowledgeEvent(id);
    }
}

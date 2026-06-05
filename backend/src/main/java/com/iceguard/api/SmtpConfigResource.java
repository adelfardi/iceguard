package com.iceguard.api;

import com.iceguard.dto.request.SaveSmtpConfigRequest;
import com.iceguard.dto.response.SmtpConfigResponse;
import com.iceguard.service.SmtpConfigService;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import java.util.Map;

@Path("/api/settings/smtp")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class SmtpConfigResource {

    @Inject
    SmtpConfigService service;

    @GET
    public SmtpConfigResponse get() {
        return service.get();
    }

    @POST
    public SmtpConfigResponse save(SaveSmtpConfigRequest request) {
        return service.save(request);
    }

    @POST
    @Path("/test")
    public Map<String, Object> testConnection() {
        boolean success = service.testConnection();
        return Map.of(
                "success", success,
                "message", success ? "SMTP connection successful" : "SMTP connection failed or not configured"
        );
    }
}

package com.iceguard.api;

import com.iceguard.dto.request.SaveSparkSettingsRequest;
import com.iceguard.dto.response.SparkSettingsResponse;
import com.iceguard.service.SparkSettingsService;
import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;

/** Global Spark session tuning (driver / executor), applied to every Spark maintenance run. */
@Path("/api/spark-settings")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class SparkSettingsResource {

    @Inject
    SparkSettingsService service;

    @GET
    public SparkSettingsResponse get() {
        return service.get();
    }

    @PUT
    public SparkSettingsResponse save(SaveSparkSettingsRequest request) {
        return service.save(request);
    }
}

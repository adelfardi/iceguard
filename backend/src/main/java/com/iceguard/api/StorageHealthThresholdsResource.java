package com.iceguard.api;

import com.iceguard.dto.request.SaveStorageHealthThresholdsRequest;
import com.iceguard.dto.response.StorageHealthThresholdsResponse;
import com.iceguard.service.StorageHealthThresholdsService;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;

@Path("/api/settings/storage-health-thresholds")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class StorageHealthThresholdsResource {

    @Inject
    StorageHealthThresholdsService service;

    @GET
    public StorageHealthThresholdsResponse get() {
        return service.get();
    }

    @PUT
    public StorageHealthThresholdsResponse save(SaveStorageHealthThresholdsRequest request) {
        return service.save(request);
    }
}

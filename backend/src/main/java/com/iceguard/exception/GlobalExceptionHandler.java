package com.iceguard.exception;

import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.ExceptionMapper;
import jakarta.ws.rs.ext.Provider;
import org.jboss.logging.Logger;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@Provider
public class GlobalExceptionHandler implements ExceptionMapper<Exception> {

    private static final Logger LOG = Logger.getLogger(GlobalExceptionHandler.class);

    @Override
    public Response toResponse(Exception exception) {
        if (exception instanceof ResourceNotFoundException) {
            return buildResponse(Response.Status.NOT_FOUND, exception.getMessage());
        }
        if (exception instanceof CatalogOperationException) {
            return buildResponse(Response.Status.BAD_GATEWAY, exception.getMessage());
        }
        if (exception instanceof IllegalArgumentException) {
            return buildResponse(Response.Status.BAD_REQUEST, exception.getMessage());
        }

        // Don't leak internal details (exception/class names, root-cause messages) to the
        // client. Log the full stack server-side under a correlation id and return only that id.
        String errorId = UUID.randomUUID().toString();
        LOG.error("Unhandled exception [errorId=" + errorId + "]", exception);
        return buildResponse(Response.Status.INTERNAL_SERVER_ERROR,
                "An internal error occurred. Reference: " + errorId);
    }

    private Response buildResponse(Response.Status status, String message) {
        return Response.status(status)
                .entity(Map.of(
                        "status", status.getStatusCode(),
                        "error", status.getReasonPhrase(),
                        "message", message,
                        "timestamp", Instant.now().toString()
                ))
                .build();
    }
}

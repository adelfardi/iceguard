package com.iceguard.exception;

import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.ExceptionMapper;
import jakarta.ws.rs.ext.Provider;
import org.jboss.logging.Logger;
import java.time.Instant;
import java.util.Map;

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

        Throwable root = exception;
        while (root.getCause() != null && root.getCause() != root) root = root.getCause();
        LOG.error("Unhandled exception (root: " + root.getClass().getName() + ")", exception);
        String msg = exception.getClass().getSimpleName() + ": " + exception.getMessage()
                + " | Root cause: " + root.getClass().getSimpleName() + ": " + root.getMessage();
        return buildResponse(Response.Status.INTERNAL_SERVER_ERROR, msg);
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

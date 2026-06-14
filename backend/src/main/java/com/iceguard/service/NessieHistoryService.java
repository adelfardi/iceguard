package com.iceguard.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.iceguard.dto.response.NessieCommitResponse;
import com.iceguard.model.CatalogConfig;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;

/**
 * Reconstructs a table's real change history from a Nessie catalog.
 *
 * Nessie deliberately exposes only the single Iceberg snapshot matching the
 * current Nessie commit, so {@code table.snapshots()} shows one entry. The full
 * history lives in Nessie's git-like commit log, read here via the native v2 API
 * ({@code GET /api/v2/trees/{ref}/history?fetch=ALL}).
 *
 * Prototype: supports NONE and BEARER auth; OAUTH2/BASIC are TODO.
 */
@ApplicationScoped
public class NessieHistoryService {

    @Inject
    ObjectMapper objectMapper;

    private final HttpClient http = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();

    public List<NessieCommitResponse> tableHistory(Long catalogId, String namespace, String table) {
        CatalogConfig cfg = CatalogConfig.findById(catalogId);
        if (cfg == null) throw new IllegalArgumentException("Catalog not found: " + catalogId);

        String apiBase = deriveNessieApiBase(cfg.uri);
        String ref = nessieRef(cfg);
        List<String> key = tableKey(namespace, table);

        String url = apiBase + "/trees/" + urlEncode(ref) + "/history?fetch=ALL&maxRecords=200";
        HttpRequest.Builder req = HttpRequest.newBuilder(URI.create(url))
                .timeout(Duration.ofSeconds(30))
                .GET();
        String auth = authHeader(cfg);
        if (auth != null) req.header("Authorization", auth);

        try {
            HttpResponse<String> resp = http.send(req.build(), HttpResponse.BodyHandlers.ofString());
            if (resp.statusCode() / 100 != 2) {
                throw new RuntimeException("Nessie history HTTP " + resp.statusCode() + " for " + url
                        + " — " + truncate(resp.body()));
            }
            return parseHistory(objectMapper.readTree(resp.body()), key);
        } catch (RuntimeException e) {
            throw e;
        } catch (Exception e) {
            throw new RuntimeException("Failed to fetch Nessie history: " + e.getMessage(), e);
        }
    }

    /**
     * Pure parser (no I/O) — extracts the commits whose operations touch the given
     * table key. Kept package-private and static so it is unit-testable.
     */
    static List<NessieCommitResponse> parseHistory(JsonNode root, List<String> tableKey) {
        List<NessieCommitResponse> out = new ArrayList<>();
        for (JsonNode entry : root.path("logEntries")) {
            JsonNode meta = entry.path("commitMeta");
            for (JsonNode op : entry.path("operations")) {
                List<String> opKey = new ArrayList<>();
                op.path("key").path("elements").forEach(n -> opKey.add(n.asText()));
                if (!opKey.equals(tableKey)) continue;

                JsonNode content = op.path("content");
                Long snapshotId = content.hasNonNull("snapshotId") ? content.get("snapshotId").asLong() : null;
                String metaLoc = content.path("metadataLocation").asText(null);
                out.add(new NessieCommitResponse(
                        meta.path("hash").asText(null),
                        meta.path("message").asText(null),
                        meta.path("author").asText(null),
                        safeInstant(meta.path("commitTime").asText(null)),
                        op.path("type").asText(null),
                        snapshotId,
                        metaLoc));
            }
        }
        return out;
    }

    /** {@code http://host/iceberg[/branch]} (or an {@code /api/v*} base) -> {@code http://host/api/v2}. */
    static String deriveNessieApiBase(String uri) {
        String base = stripTrailingSlash(uri.trim());
        int i = base.indexOf("/iceberg");
        if (i >= 0) base = base.substring(0, i);
        int a = base.indexOf("/api/v");
        if (a >= 0) base = base.substring(0, a);
        return stripTrailingSlash(base) + "/api/v2";
    }

    private String nessieRef(CatalogConfig cfg) {
        Map<String, String> props = parseJson(cfg.properties);
        if (props.containsKey("nessie.ref")) return props.get("nessie.ref");
        int i = cfg.uri.indexOf("/iceberg/");
        if (i >= 0) {
            String branch = cfg.uri.substring(i + "/iceberg/".length()).split("[/?]", 2)[0];
            if (!branch.isBlank()) return branch;
        }
        return "main";
    }

    private static List<String> tableKey(String namespace, String table) {
        List<String> key = new ArrayList<>(Arrays.asList(namespace.split("\\.")));
        key.add(table);
        return key;
    }

    private String authHeader(CatalogConfig cfg) {
        Map<String, String> creds = parseJson(cfg.credentials);
        if (cfg.authType == CatalogConfig.AuthType.BEARER && creds.containsKey("token")) {
            return "Bearer " + creds.get("token");
        }
        return null; // NONE (and OAUTH2/BASIC not handled in this prototype)
    }

    private Map<String, String> parseJson(String json) {
        try {
            if (json == null || json.isBlank()) return Map.of();
            return objectMapper.readValue(json, objectMapper.getTypeFactory()
                    .constructMapType(Map.class, String.class, String.class));
        } catch (Exception e) {
            return Map.of();
        }
    }

    private static Instant safeInstant(String s) {
        try {
            return s == null ? null : Instant.parse(s);
        } catch (Exception e) {
            return null;
        }
    }

    private static String stripTrailingSlash(String s) {
        return s.endsWith("/") ? s.substring(0, s.length() - 1) : s;
    }

    private static String urlEncode(String s) {
        return URLEncoder.encode(s, StandardCharsets.UTF_8);
    }

    private static String truncate(String s) {
        if (s == null) return "";
        return s.length() > 300 ? s.substring(0, 300) + "…" : s;
    }
}

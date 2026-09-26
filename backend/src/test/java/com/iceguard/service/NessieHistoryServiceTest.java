package com.iceguard.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.iceguard.dto.response.NessieCommitResponse;
import com.iceguard.dto.response.NessieReferenceResponse;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

/** Pure unit tests for the Nessie commit-log parsing — no Quarkus / DB needed. */
class NessieHistoryServiceTest {

    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void parsesOnlyCommitsTouchingTheTableKey() throws Exception {
        String json = """
            { "logEntries": [
              { "commitMeta": {"hash":"c2","message":"insert","author":"me","commitTime":"2026-06-05T14:00:00Z"},
                "operations": [
                  {"type":"PUT","key":{"elements":["analytics","events"]},
                   "content":{"type":"ICEBERG_TABLE","metadataLocation":"s3://w/2.json","snapshotId":222}} ] },
              { "commitMeta": {"hash":"c1","message":"create","author":"me","commitTime":"2026-06-05T13:00:00Z"},
                "operations": [
                  {"type":"PUT","key":{"elements":["analytics","events"]},
                   "content":{"type":"ICEBERG_TABLE","metadataLocation":"s3://w/1.json","snapshotId":111}},
                  {"type":"PUT","key":{"elements":["analytics","other"]},
                   "content":{"type":"ICEBERG_TABLE","metadataLocation":"s3://w/x.json","snapshotId":999}} ] }
            ] }
            """;

        List<NessieCommitResponse> commits =
                NessieHistoryService.parseHistory(mapper.readTree(json), List.of("analytics", "events"));

        assertEquals(2, commits.size(), "only the two commits touching analytics.events");
        assertEquals("c2", commits.get(0).hash());
        assertEquals(222L, commits.get(0).snapshotId());
        assertEquals("s3://w/2.json", commits.get(0).metadataLocation());
        assertEquals("PUT", commits.get(0).operation());
        assertEquals("c1", commits.get(1).hash());
        assertEquals(111L, commits.get(1).snapshotId());
    }

    @Test
    void handlesMissingSnapshotIdAndEmptyLog() throws Exception {
        String json = """
            { "logEntries": [
              { "commitMeta": {"hash":"d1","message":"drop","commitTime":"2026-06-05T13:00:00Z"},
                "operations": [ {"type":"DELETE","key":{"elements":["ns","t"]}} ] }
            ] }
            """;
        List<NessieCommitResponse> commits =
                NessieHistoryService.parseHistory(mapper.readTree(json), List.of("ns", "t"));
        assertEquals(1, commits.size());
        assertEquals("DELETE", commits.get(0).operation());
        assertNull(commits.get(0).snapshotId());

        assertEquals(0, NessieHistoryService.parseHistory(mapper.readTree("{}"), List.of("ns", "t")).size());
    }

    @Test
    void derivesNessieApiBaseFromVariousUris() {
        assertEquals("http://host/api/v2", NessieHistoryService.deriveNessieApiBase("http://host/iceberg"));
        assertEquals("http://host/api/v2", NessieHistoryService.deriveNessieApiBase("http://host/iceberg/main"));
        assertEquals("http://host/api/v2", NessieHistoryService.deriveNessieApiBase("http://host/iceberg/"));
        assertEquals("http://host/api/v2", NessieHistoryService.deriveNessieApiBase("http://host/api/v2"));
        assertEquals("https://nessie.example.com/api/v2",
                NessieHistoryService.deriveNessieApiBase("https://nessie.example.com/iceberg"));
    }

    @Test
    void parsesCatalogReferences() throws Exception {
        String json = """
            { "references": [
              {"type":"BRANCH","name":"main","hash":"aaa"},
              {"type":"TAG","name":"v1","hash":"bbb"} ] }
            """;
        List<NessieReferenceResponse> refs = NessieHistoryService.parseReferences(mapper.readTree(json));
        assertEquals(2, refs.size());
        assertEquals("main", refs.get(0).name());
        assertEquals("BRANCH", refs.get(0).type());
        assertEquals("TAG", refs.get(1).type());
        assertEquals("bbb", refs.get(1).hash());

        assertEquals(0, NessieHistoryService.parseReferences(mapper.readTree("{}")).size());
    }
}

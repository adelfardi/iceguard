package com.iceguard.dto.response;

import java.util.List;

/** Individual files within a partition (or the whole table), for storage drill-down. */
public record StorageFilesResponse(
        String partition,
        int returned,
        boolean truncated,
        List<FileEntry> files
) {
    public record FileEntry(
            String path,
            String content,        // DATA | POSITION_DELETES | EQUALITY_DELETES
            long sizeBytes,
            long recordCount,
            int specId
    ) {}
}

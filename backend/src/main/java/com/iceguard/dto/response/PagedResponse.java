package com.iceguard.dto.response;

import java.util.List;

/**
 * Generic envelope for server-side paginated results.
 *
 * @param items the page contents
 * @param total total number of matching rows (across all pages)
 * @param page  zero-based page index
 * @param size  page size that was requested
 */
public record PagedResponse<T>(List<T> items, long total, int page, int size) {}

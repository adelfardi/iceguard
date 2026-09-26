package com.iceguard.dto.response;

/** A partition touched within a recent time window, with the number of commits that touched it. */
public record HotPartitionResponse(String partition, int commits) {}

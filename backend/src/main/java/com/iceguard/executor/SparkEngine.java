package com.iceguard.executor;

import jakarta.inject.Qualifier;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Qualifier for the Spark-based {@link MaintenanceExecutor}, so it can coexist with
 * the default {@code JavaApiExecutor} without making CDI injection ambiguous.
 */
@Qualifier
@Retention(RetentionPolicy.RUNTIME)
@Target({ElementType.TYPE, ElementType.FIELD, ElementType.PARAMETER, ElementType.METHOD})
public @interface SparkEngine {
}
